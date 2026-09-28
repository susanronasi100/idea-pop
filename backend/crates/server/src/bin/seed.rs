//! Idempotent seed binary — inserts reference content if not already present.
//!
//! Usage: DATABASE_URL=... cargo run -p idea-pop-server --bin seed
//! Re-running is safe: reference content upserts by slug. Challenges use
//! ON CONFLICT (slug) DO UPDATE so authored content changes (e.g. step hint
//! text) reliably land on existing rows — updates never touch row ids, so
//! FK references (projects, attempts, ideas, help_messages) are unaffected.

#![forbid(unsafe_code)]
#![allow(clippy::type_complexity)]

use sqlx::PgPool;

#[path = "../seed_season2.rs"]
mod seed_season2;
#[path = "../seed_stories.rs"]
mod seed_stories;
#[path = "../seed_translations.rs"]
mod seed_translations;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;

    sqlx::migrate!("../../migrations").run(&pool).await?;
    println!("migrations OK");

    seed_creators(&pool).await?;
    seed_courses(&pool).await?;
    seed_lessons(&pool).await?;
    seed_explore_videos(&pool).await?;
    seed_quick_makes(&pool).await?;
    seed_challenges(&pool).await?;
    seed_season2::seed_season_2(&pool).await?;
    seed_stories::seed_stories(&pool).await?;
    seed_translations::seed_translations(&pool).await?;
    seed_badges(&pool).await?;

    println!("seed complete");
    Ok(())
}

async fn seed_badges(pool: &PgPool) -> anyhow::Result<()> {
    let badges: &[(&str, &str, &str, serde_json::Value)] = &[
        (
            "nature-scout",
            "Nature Scout",
            "Watch 3 Explore videos",
            serde_json::json!({"type": "video_count", "min": 3}),
        ),
        (
            "bridge-builder",
            "Bridge Builder",
            "Complete your first Challenge",
            serde_json::json!({"type": "challenge_count", "min": 1}),
        ),
        (
            "slime-master",
            "Slime Master",
            "Complete 3 Lessons",
            serde_json::json!({"type": "lesson_count", "min": 3}),
        ),
        (
            "cycle-starter",
            "Cycle Starter",
            "Complete a Creative Cycle (Explore + Learn + Solve in one week)",
            serde_json::json!({"type": "cycle_count", "min": 1}),
        ),
    ];

    for (slug, name, description, criteria) in badges {
        sqlx::query(
            "INSERT INTO badges (slug, name, description, criteria)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (slug) DO NOTHING",
        )
        .bind(slug)
        .bind(name)
        .bind(description)
        .bind(sqlx::types::Json(criteria))
        .execute(pool)
        .await?;
    }
    println!("seeded badges");
    Ok(())
}

async fn seed_creators(pool: &PgPool) -> anyhow::Result<()> {
    let rows: &[(&str, &str, &str, &str)] = &[
        (
            "Ms. Noor",
            "Art educator and illustrator who believes every child is a natural artist.",
            "art",
            "https://assets.idea-pop.app/creators/ms-noor.png",
        ),
        (
            "Mr. Modaresi Nia",
            "AI Expert, 7 years teaching kids. Every lesson is reviewed by the Idea Pop team before it goes live.",
            "code",
            "https://assets.idea-pop.app/creators/modaresi-nia.png",
        ),
    ];

    for (name, bio, studio, avatar) in rows {
        sqlx::query(
            r#"INSERT INTO creators (display_name, bio, studio, avatar_url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(name)
        .bind(bio)
        .bind(studio)
        .bind(avatar)
        .execute(pool)
        .await?;
    }
    println!("creators seeded");
    Ok(())
}

async fn creator_id_by_name(pool: &PgPool, name: &str) -> anyhow::Result<Option<uuid::Uuid>> {
    Ok(
        sqlx::query_scalar("SELECT id FROM creators WHERE display_name = $1 LIMIT 1")
            .bind(name)
            .fetch_optional(pool)
            .await?,
    )
}

async fn seed_courses(pool: &PgPool) -> anyhow::Result<()> {
    // (title, slug, studio, creator_name, summary, difficulty, age_min, materials)
    let courses: &[(&str, &str, &str, &str, &str, i16, i16, &[&str])] = &[
        (
            "Drawing Animals 101",
            "drawing-animals-101",
            "art",
            "Ms. Noor",
            "Learn to draw 6 beloved animals step by step — from the first pencil line to the final colour wash.",
            1,
            8,
            &["paper", "pencil"],
        ),
        (
            "Let's Learn about AI",
            "lets-learn-about-ai",
            "code",
            "Mr. Modaresi Nia",
            "Discover how computers 'see' shapes and patterns in the world — then build your very own creature.",
            1,
            11,
            &["laptop", "internet"],
        ),
    ];

    for (title, slug, studio, creator_name, summary, difficulty, age_min, materials) in courses {
        let Some(creator_id) = creator_id_by_name(pool, creator_name).await? else {
            println!("creator '{creator_name}' not found — skipping course '{slug}'");
            continue;
        };
        let materials: Vec<String> = materials.iter().map(|m| m.to_string()).collect();
        sqlx::query(
            r#"INSERT INTO courses
                   (title, slug, studio, creator_id, summary, difficulty, age_min, materials)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (slug) DO NOTHING"#,
        )
        .bind(title)
        .bind(slug)
        .bind(studio)
        .bind(creator_id)
        .bind(summary)
        .bind(difficulty)
        .bind(age_min)
        .bind(&materials)
        .execute(pool)
        .await?;
    }

    println!("courses seeded");
    Ok(())
}

async fn seed_lessons(pool: &PgPool) -> anyhow::Result<()> {
    // (course_slug, [(ordinal, title, duration_s, xp_reward)])
    let courses: &[(&str, &[(i16, &str, i32, i16)])] = &[
        (
            "drawing-animals-101",
            &[
                (1, "Warm-Up: Circles & Ovals", 300, 10),
                (2, "Drawing a Bunny", 480, 10),
                (3, "Drawing a Fox", 540, 10),
                (4, "Drawing an Owl", 510, 10),
                (5, "Drawing a Whale", 600, 10),
                (6, "Drawing an Elephant", 660, 10),
            ],
        ),
        (
            "lets-learn-about-ai",
            &[
                (1, "Shapes hiding in animals", 360, 10),
                (2, "Big cat faces", 420, 10),
                (3, "Birds in 5 lines", 480, 10),
                (4, "The octopus — curves everywhere", 480, 10),
                (5, "Texture: scales & fur", 540, 10),
                (6, "Make your OWN creature!", 600, 20),
            ],
        ),
    ];

    for (slug, lessons) in courses {
        let course_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM courses WHERE slug = $1 LIMIT 1")
                .bind(slug)
                .fetch_optional(pool)
                .await?;

        let Some(course_id) = course_id else {
            println!("course '{slug}' not found — skipping lessons");
            continue;
        };

        for (ordinal, title, duration_s, xp_reward) in *lessons {
            let video_url =
                format!("https://assets.idea-pop.app/courses/{slug}/lesson-{ordinal}.mp4");
            sqlx::query(
                r#"INSERT INTO lessons (course_id, ordinal, title, video_url, duration_s, xp_reward)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (course_id, ordinal) DO NOTHING"#,
            )
            .bind(course_id)
            .bind(ordinal)
            .bind(title)
            .bind(&video_url)
            .bind(duration_s)
            .bind(xp_reward)
            .execute(pool)
            .await?;
        }
    }
    println!("lessons seeded");
    Ok(())
}

async fn seed_explore_videos(pool: &PgPool) -> anyhow::Result<()> {
    // (slug, title, superpower_category, taxonomy, design_secret, sticker_id, age_modes, ai_generated, duration_s)
    let videos: &[(&str, &str, &str, &str, &str, &str, &[&str], bool, i32)] = &[
        (
            "how-octopuses-think",
            "How Octopuses Think",
            "masters_of_disguise",
            "Cephalopoda",
            "Each arm has its own mini-brain — 8 arms, 8 tiny brains, all working together!",
            "octopus",
            &["young", "older"],
            false,
            240,
        ),
        (
            "coral-reef-architects",
            "Coral Reef Architects",
            "master_builders",
            "Anthozoa",
            "A coral polyp builds its own tiny limestone castle to live in.",
            "coral",
            &["young", "older"],
            false,
            210,
        ),
        (
            "bioluminescent-deep-sea",
            "Bioluminescent Deep Sea",
            "masters_of_disguise",
            "Dinoflagellata",
            "Some sea creatures make their own light — no batteries needed!",
            "anglerfish",
            &["older"],
            false,
            300,
        ),
        (
            "ant-colony-engineers",
            "Ant Colony Engineers",
            "master_builders",
            "Hymenoptera",
            "Leaf-cutter ants grow their own fungus garden underground.",
            "ant",
            &["young", "older"],
            false,
            270,
        ),
        (
            "rainforest-color-chemistry",
            "Rainforest Color Chemistry",
            "masters_of_disguise",
            "Botany",
            "Bright flowers trick bees with ultraviolet patterns we can't see!",
            "flower",
            &["young", "older"],
            false,
            255,
        ),
        (
            "mangrove-root-worlds",
            "Mangrove Root Worlds",
            "soft_engineers",
            "Rhizophora",
            "Mangrove roots trap mud to build new land — a tree that makes islands!",
            "mangrove",
            &["young"],
            false,
            195,
        ),
        (
            "desert-sand-sculptures",
            "Desert Sand Sculptures",
            "master_builders",
            "Geology",
            "Wind is the sculptor — it carves rock into arches over thousands of years.",
            "arch-rock",
            &["young", "older"],
            false,
            225,
        ),
        (
            "camel-water-secrets",
            "Camel Water Secrets",
            "soft_engineers",
            "Mammalia",
            "Camels store fat (not water!) in their humps as a travel energy pack.",
            "camel",
            &["older"],
            false,
            285,
        ),
        (
            "thermal-updrafts",
            "Riding Thermal Updrafts",
            "speed_champions",
            "Meteorology",
            "Hot air rises and forms invisible elevators that birds and gliders use for free lift.",
            "hawk",
            &["older"],
            false,
            240,
        ),
        (
            "bird-v-formation",
            "Why Birds Fly in V-Formation",
            "speed_champions",
            "Aves",
            "Each bird rides the upwash from the wingtip ahead — teamwork saves energy!",
            "goose",
            &["young", "older"],
            false,
            220,
        ),
    ];

    for (slug, title, category, taxonomy, secret, sticker, age_modes, ai_gen, duration_s) in videos
    {
        let age_modes_vec: Vec<String> = age_modes.iter().map(|s| s.to_string()).collect();
        let video_url = format!("https://assets.idea-pop.app/explore/{slug}.mp4");
        sqlx::query(
            r#"INSERT INTO explore_videos
               (title, slug, superpower_category, taxonomy, video_url, duration_s,
                design_secret, sticker_id, xp_reward, ai_generated, age_modes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5, $9, $10)
               ON CONFLICT (slug) DO NOTHING"#,
        )
        .bind(title)
        .bind(slug)
        .bind(category)
        .bind(taxonomy)
        .bind(&video_url)
        .bind(duration_s)
        .bind(secret)
        .bind(sticker)
        .bind(ai_gen)
        .bind(&age_modes_vec)
        .execute(pool)
        .await?;
    }
    println!("explore_videos seeded ({} entries)", videos.len());
    Ok(())
}

async fn seed_quick_makes(pool: &PgPool) -> anyhow::Result<()> {
    // (slug, title, studio, difficulty, time_minutes, mess_level, materials, ai_generated)
    let makes: &[(&str, &str, &str, i16, i16, i16, &[&str], bool)] = &[
        (
            "galaxy-slime",
            "Galaxy Slime",
            "craft",
            1,
            20,
            3,
            &[
                "white PVA glue",
                "food colouring",
                "glitter",
                "borax",
                "warm water",
            ],
            false,
        ),
        (
            "pop-up-box-card",
            "Pop-Up Box Card",
            "art",
            2,
            30,
            1,
            &["cardstock", "scissors", "ruler", "glue stick", "markers"],
            false,
        ),
    ];

    for (slug, title, studio, difficulty, time_min, mess, materials, ai_gen) in makes {
        let materials_vec: Vec<String> = materials.iter().map(|s| s.to_string()).collect();
        let video_url = format!("https://assets.idea-pop.app/quick-makes/{slug}.mp4");
        sqlx::query(
            r#"INSERT INTO quick_makes
               (title, slug, studio, difficulty, time_minutes, materials,
                mess_level, video_url, xp_reward, ai_generated)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5, $9)
               ON CONFLICT (slug) DO NOTHING"#,
        )
        .bind(title)
        .bind(slug)
        .bind(studio)
        .bind(difficulty)
        .bind(time_min)
        .bind(&materials_vec)
        .bind(mess)
        .bind(&video_url)
        .bind(ai_gen)
        .execute(pool)
        .await?;
    }
    println!("quick_makes seeded ({} entries)", makes.len());
    Ok(())
}

async fn seed_challenges(pool: &PgPool) -> anyhow::Result<()> {
    // Each challenge is a full 8-step mission stored as JSONB.
    // ON CONFLICT (slug) DO UPDATE keeps re-runs idempotent AND authoritative:
    // existing rows get the current authored content (ids preserved — never
    // delete challenge rows; children's projects/attempts reference them).

    // (slug, title, season, week, steps, tools, variants, is_premium)
    let challenges: &[(&str, &str, i16, i16, &str, &str, &str, bool)] = &[
        (
            "help-max-cross-the-river",
            "Help Max Cross the River",
            1,
            1,
            // steps JSON
            r#"[
  {"step":"brief","title":"Max Can't Get to the Science Fair!","story":"Max the rabbit wakes up to find the old wooden bridge over the river has collapsed. The river is 2 metres wide, his friends are waiting on the other side, and today is the science fair. Can YOU design a crossing that carries Max safely over, using only light materials he can carry?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for how Max could cross the river?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature stay on top of water? Nature has been crossing rivers and floating on water for millions of years. Let's look for clues!","clues":[{"text":"Water striders have long legs covered in tiny waxy hairs. They spread the insect's weight so widely that it stands on the water's skin without breaking it.","image_url":null,"habitat":"jungle"},{"text":"Fire ants link their bodies together into a living raft when floods come. Air trapped between them keeps the whole colony afloat for days.","image_url":null,"habitat":"jungle"},{"text":"The giant water lily's huge leaf has a rim and a web of air-filled ribs underneath, so it floats even with a small child on it.","image_url":null,"habitat":"jungle"},{"text":"Coconuts float across oceans for months. Their thick, fibrous husk traps air and keeps the seed dry.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"An object floats when it pushes aside water that weighs more than it does. That's called buoyancy. A wide, hollow shape pushes aside lots of water, so even heavy things like steel ships float. Spreading weight over a big area also stops things breaking through the surface.","reveal_hint":"How could you make Max's crossing push aside as much water as possible?"},
  {"step":"skill","instructions":"Make a ball of modelling clay and drop it in water. It sinks! Now flatten the same clay into a boat and add coins one at a time until it sinks. Try three boat shapes, like wide and flat, deep and narrow, and one with a rim. Record how many coins each one holds.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw Max's crossing: a bridge, a raft, stepping stones or your own invention.","guidance":"Label the materials and show where the air or the wide surface keeps it up. Add measurements."},
  {"step":"build_and_test","instructions":"Build a model crossing from foil, straws, corks, card or sticks. Test it over a tray of water, loading it with coins as Max's weight.","test_criteria":["How many coins can it carry before it sinks or sags into the water?","Does it stay stable when you make small waves in the tray?","Improve one thing and test again. How many more coins does it hold?"]},
  {"step":"celebrate_and_share","celebration_text":"Max made it to the science fair, and won the prize for Most Creative Crossing!","share_prompt":"Share your crossing and your coin results on the Ideas Wall. Which nature trick kept it afloat?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"scamper","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Compare boat shapes by the coins they carry, then build a crossing and improve its load in a second round."},
  {"age_tier":"12-18","title_override":"Engineering Max's Crossing","summary":"Explain buoyancy and displacement, compare bridge and raft designs by load per gram of material, and link your best design to water striders or lily pads."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-forest-picnic-problem",
            "The Forest Picnic Problem",
            1,
            2,
            // steps JSON
            r#"[
  {"step":"brief","title":"Rain on the Way: Picnic in Danger!","story":"The Rossi family has planned their forest picnic for weeks, with sandwiches, juice and a birthday cake. This morning the forecast says showers. They won't cancel, but they need a shelter that keeps everything dry, packs into a backpack and sets up in under 5 minutes. That's where YOU come in!","image_url":null},
  {"step":"your_idea","prompt":"Got an idea for a quick, portable rain shelter?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature shed water? Plants and animals stay dry in the rain without umbrellas. Let's borrow their best ideas!","clues":[{"text":"The lotus leaf is covered in microscopic waxy bumps. Water droplets sit on the tips, roll right off and carry dirt away with them.","image_url":null,"habitat":"jungle"},{"text":"Duck feathers overlap like roof tiles and are coated with oil from a gland near the tail, so water slides off them.","image_url":null,"habitat":"ocean"},{"text":"Rainforest leaves often end in a long pointed \"drip tip\" that drains rain off quickly, so the leaf dries fast.","image_url":null,"habitat":"jungle"},{"text":"A woodpecker's nest hole usually faces away from the wind and rain, so water can't drip inside.","image_url":null,"habitat":"forest"}]},
  {"step":"design_secret","secret":"The lotus effect works because water touches only the tips of tiny waxy bumps, so it can't spread out and soak in. Surfaces like this are called superhydrophobic, which means water-hating. Engineers copy the lotus leaf to make self-cleaning paint, glass and fabric.","reveal_hint":"How could your shelter make water bead up and run away from the picnic?"},
  {"step":"skill","instructions":"Test four surfaces: plain paper, paper rubbed with a wax crayon, foil and a leaf. Drip 10 drops of water on each, tilted at the same angle, and count how many roll off. Record the surface, the drops that rolled off and whether any soaked in.","skill_refs":[]},
  {"step":"sketch","prompt":"Design the Rossi family's shelter from the side and from above.","guidance":"Mark your \"lotus layer\", show the roof angle and draw arrows for where the rain goes."},
  {"step":"build_and_test","instructions":"Build a model shelter from materials around your home. Put a tissue underneath as the picnic, then pour 3 tablespoons of water over the roof.","test_criteria":["Is the tissue under the shelter still dry?","Does the water run off, or does it pool on the roof?","Change the roof angle or material and test again. What changed?"]},
  {"step":"celebrate_and_share","celebration_text":"The birthday cake stayed perfectly dry, and it was the best picnic the Rossi family ever had!","share_prompt":"Share your shelter and your drip-test table on the Ideas Wall. What was your secret waterproof material?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"mind_map","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Run a drip test on four surfaces, then build a shelter and improve its roof angle or material."},
  {"age_tier":"12-18","title_override":"Biomimicry: Designing a Superhydrophobic Shelter","summary":"Research the lotus effect and contact angle, measure roll-off at different roof angles, and design a surface that maximises water shedding."}
]"#,
            true, // premium — unlocks with a family subscription
        ),
        (
            "now-you-see-it",
            "Now You See It, Now You Don't",
            1,
            3,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Birds Keep Flying Away!","story":"Aria's nature club wants to film the shy birds that visit the park pond, but the birds fly off whenever they spot the camera. The club needs a cover for the camera box that blends into the bushes. Can YOU design camouflage so good that your friends can't find it?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have a camouflage idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature hide in plain sight? Some animals are masters of disguise. They hide right in front of us. Let's discover their secrets!","clues":[{"text":"Cuttlefish can change their skin colour and pattern in less than a second to match the sand, rocks or seaweed around them.","image_url":null,"habitat":"ocean"},{"text":"Stick insects look and even move like twigs. They sway gently, as if the wind is blowing them.","image_url":null,"habitat":"jungle"},{"text":"Many fish and deer are darker on top and paler underneath. This 'countershading' cancels out the shadow on their bellies, so they look flat and hard to see.","image_url":null,"habitat":"forest"},{"text":"Zebras' bold stripes break up the outline of their bodies, so a herd is hard to pick apart when it's moving.","image_url":null,"habitat":"grassland"}]},
  {"step":"design_secret","secret":"Eyes find objects by spotting outlines, shadows and colours that don't match. Good camouflage attacks all three: match the colours, break up the outline with a pattern, and cancel the shadow. The military and wildlife photographers use the same tricks.","reveal_hint":"Which gives your camera box away most: its colour, its shape or its shadow?"},
  {"step":"skill","instructions":"Cut the same shape out of plain paper, patterned paper and paper you've coloured to match a spot in your garden or room. Hide each one in the same spot and ask a friend to find it. Time each search and record the results.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your camera cover in its hiding place.","guidance":"Label how you match colour, break up the outline and hide the shadow."},
  {"step":"build_and_test","instructions":"Cover a small box with your camouflage using paper, fabric, leaves or paint. Hide it and a plain box in the same area, then ask 3 people to find each one.","test_criteria":["How many seconds, on average, does it take to spot your box compared to the plain one?","Which trick helped most: colour, outline or shadow? Test one at a time.","Does it still work from a different distance or angle?"]},
  {"step":"celebrate_and_share","celebration_text":"The birds came right up to the pond, and the nature club filmed them all! Your camouflage fooled even the sharp-eyed herons.","share_prompt":"Share a photo of your hidden box on the Ideas Wall and challenge others to find it. How long did your friends take?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"mind_map","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Time how long friends take to find plain and camouflaged objects, then improve your design one trick at a time."},
  {"age_tier":"12-18","title_override":"Biomimicry: Camouflage and Visual Perception","summary":"Explain background matching, disruptive patterns and countershading, collect timed search data from several viewers, and report which strategy mattered most."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "water-from-thin-air",
            "Water from Thin Air",
            1,
            4,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Garden Is Dying of Thirst!","story":"The school garden sits on a dry hillside where it hardly ever rains. But every morning, thick fog rolls in, and the plants are still thirsty. Can YOU design a fog catcher that turns morning mist into water for the garden?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for catching water from the air?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature collect water from the air? Some plants and animals live in deserts where it almost never rains. So where do they get their water? Let's find out!","clues":[{"text":"The Namib desert beetle does a headstand into the morning fog. Tiny water-loving bumps on its back catch droplets, which grow and roll down waxy grooves into its mouth.","image_url":null,"habitat":"desert"},{"text":"The thorny devil lizard has tiny channels between its scales. They pull water from damp sand across its skin to its mouth.","image_url":null,"habitat":"desert"},{"text":"Spider silk has little knots along each thread. Fog droplets collect on the knots and grow into big drops, which is why webs sparkle in the morning.","image_url":null,"habitat":"forest"},{"text":"Some cacti have spines shaped like cones with tiny grooves. Fog collects on the tips and slides down to the plant's base.","image_url":null,"habitat":"desert"}]},
  {"step":"design_secret","secret":"Fog is made of tiny droplets too small to fall. A catcher gives them something to hit and stick to. Once enough droplets join, they're heavy enough to roll away along a smooth, slippery path. Fog nets in Chile and Morocco collect hundreds of litres of water a day this way.","reveal_hint":"Where should drops stick, and where should they slide?"},
  {"step":"skill","instructions":"With an adult's help, hang three materials, like a mesh bag, a cotton cloth and a plastic sheet, in the steam above a bowl of hot water. After 5 minutes, measure how much water drips off each into a cup.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your fog catcher from the front and the side.","guidance":"Show where droplets stick, which way they run, and how the water gets into the collecting cup."},
  {"step":"build_and_test","instructions":"Build a fog catcher from mesh, string, plastic, straws and a cup. Test it in a steamy bathroom after a shower or mist it with a spray bottle from 1 metre away.","test_criteria":["How many millilitres does it collect in 10 minutes?","Does the water reach the cup, or does it drip off somewhere else?","Change the mesh or the angle and test again. Did you collect more?"]},
  {"step":"celebrate_and_share","celebration_text":"The garden is green again, watered by the morning fog! Your catcher turned mist into life.","share_prompt":"Share your fog catcher and how many millilitres it collected on the Ideas Wall. Which desert animal did you copy?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Compare materials in steam, then build a fog catcher and measure the millilitres it collects in 10 minutes."},
  {"age_tier":"12-18","title_override":"Biomimicry: Fog Harvesting","summary":"Explain hydrophilic and hydrophobic surfaces, measure collection rate against mesh type and angle, and compare with real fog nets in Chile and Morocco."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "save-the-egg",
            "Save the Egg!",
            1,
            5,
            // steps JSON
            r#"[
  {"step":"brief","title":"Special Delivery: Handle with Care!","story":"A wildlife rescue centre needs to send a precious egg to another centre, and the parcel will be bumped and dropped along the way. Can YOU design packaging that protects a fragile egg from a 2-metre fall, using as little material as possible?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for protecting something fragile?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature protect against impact? Some animals and fruits survive huge knocks and falls every day. Let's find out how they do it!","clues":[{"text":"A woodpecker hammers trees up to 20 times a second. Its spongy skull bone and a long tongue bone wrapped around its head help soak up the shock.","image_url":null,"habitat":"forest"},{"text":"A pomelo fruit can fall 10 metres from a tree without splitting. Its thick peel is a foam of air pockets that squash and spread the impact.","image_url":null,"habitat":"jungle"},{"text":"Hedgehogs roll into a ball when they fall. Their springy spines bend and absorb the shock of landing.","image_url":null,"habitat":"forest"},{"text":"A bighorn sheep's horns and skull are built in layers that absorb the force when two rams crash heads.","image_url":null,"habitat":"grassland"}]},
  {"step":"design_secret","secret":"A fall hurts because the object stops suddenly. If something squashes slowly on impact, the stop takes longer, and the force is much smaller. Layers of springy or foamy material do this, just like a pomelo peel. Engineers use these ideas to design bike helmets and car crumple zones.","reveal_hint":"How could your packaging make the egg stop more slowly?"},
  {"step":"skill","instructions":"Drop a raw egg in a zip bag from 30 cm onto a tray. Then test the same height with the egg wrapped in paper, in bubble wrap and in crumpled paper. Record which ones crack. Always do this over a tray with an adult nearby.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your packaging as a cross-section, as if you cut it in half.","guidance":"Label each layer and how it slows the egg down. Write the total weight of materials."},
  {"step":"build_and_test","instructions":"Build packaging from paper, card, straws, cotton, rubber bands or sponge. Drop it from 50 cm, then 1 metre, then 2 metres, over a tray or outside.","test_criteria":["What is the highest drop your egg survives?","How many grams of material did you use?","Remove one layer and test again. Is the egg still safe?"]},
  {"step":"celebrate_and_share","celebration_text":"The egg arrived safely at the new rescue centre, and hatched into a healthy chick!","share_prompt":"Share your packaging and your highest safe drop on the Ideas Wall. Which nature trick protected the egg?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"scamper","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Test wraps from low heights, then build packaging and find the highest drop your egg survives."},
  {"age_tier":"12-18","title_override":"Biomimicry: Impact Absorption","summary":"Explain impulse and stopping time, compare drop height survived per gram of packaging, and relate your layers to pomelo peel and woodpecker skulls."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "clean-the-pond",
            "Clean the Pond",
            1,
            6,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Frog Pond Is Murky!","story":"After a big storm, the school frog pond is brown with mud and bits of leaves. The frogs need clean water, and there's no money for a pump or filter. Can YOU design a filter that makes murky water clear again, using only natural and recycled materials?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for cleaning dirty water?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature filter water? Nature cleans huge amounts of water every day, with no machines at all. Let's find out how!","clues":[{"text":"One oyster can filter up to 50 litres of water a day. It pulls water over its gills, where sticky mucus traps tiny bits of dirt and food.","image_url":null,"habitat":"ocean"},{"text":"Baleen whales gulp huge mouthfuls of seawater and push it out through bristly plates, called baleen, that trap krill inside.","image_url":null,"habitat":"ocean"},{"text":"Mangrove roots and marsh plants slow river water down, so mud and dirt sink to the bottom before the water reaches the sea.","image_url":null,"habitat":"jungle"},{"text":"Soil and sand clean rainwater as it trickles slowly through the layers into underground rivers.","image_url":null,"habitat":"forest"}]},
  {"step":"design_secret","secret":"Filters work by trapping particles in gaps smaller than they are. The trick is to use layers: coarse gaps first to catch big bits, then finer and finer ones. If the fine layer comes first, it clogs straight away. Slowing water down also lets heavy mud settle on its own.","reveal_hint":"In what order should your layers go, and why?"},
  {"step":"skill","instructions":"Mix a jar of muddy water. Pour equal amounts through cotton, sand, gravel and a coffee filter. Rate how clear each one comes out on a 1 to 5 scale, and time how long each takes to drain.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your filter as a cross-section.","guidance":"Label every layer from top to bottom and explain what each one catches."},
  {"step":"build_and_test","instructions":"Build a layered filter in a cut plastic bottle, using gravel, sand, cotton, cloth or charcoal. Pour 250 ml of muddy water through it. This water is for frogs and plants only, never for drinking.","test_criteria":["How clear is the water that comes out, on your 1 to 5 scale?","How long does it take to filter 250 ml?","Change the order of your layers and test again. What happened?"]},
  {"step":"celebrate_and_share","celebration_text":"The frog pond is clear again, and the frogs are croaking happily! Your filter saved their home.","share_prompt":"Share a before-and-after photo of your water on the Ideas Wall. Which layer made the biggest difference?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Compare filter materials for clarity and speed, then build a layered filter and test different layer orders."},
  {"age_tier":"12-18","title_override":"Biomimicry: Natural Filtration","summary":"Explain particle size and layered filtration, trade clarity against flow rate, and compare your filter with oysters and constructed wetlands."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "stop-the-beach-washing-away",
            "Stop the Beach Washing Away",
            1,
            7,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Beach Is Disappearing!","story":"Every winter, big waves wash away more of Seaside Bay's beach, and the dunes are shrinking. The town wants to protect it without building a huge concrete wall. Can YOU design a barrier, inspired by nature, that stops the sand from washing away?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for holding sand in place?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature hold ground against water? Rivers, waves and wind move sand and soil all the time. Some plants and animals are experts at holding it in place. Let's look!","clues":[{"text":"Marram grass grows on sand dunes. Its long, tangled roots bind the sand together, and its leaves slow the wind so sand piles up instead of blowing away.","image_url":null,"habitat":"ocean"},{"text":"Mangrove trees stand on tangled stilt roots in the sea. The roots break up waves and trap mud, which slowly builds new land.","image_url":null,"habitat":"jungle"},{"text":"Oyster reefs grow in rough, bumpy mounds that slow down waves before they reach the shore.","image_url":null,"habitat":"ocean"},{"text":"Beavers build dams from sticks, mud and stones that slow rivers down and let mud settle behind them.","image_url":null,"habitat":"forest"}]},
  {"step":"design_secret","secret":"Water carries sand away when it moves fast. Slow it down, and the sand drops and stays. Rough, bumpy, gappy barriers work better than flat walls, because they break up the wave's energy instead of bouncing it back. Tangled roots add a second trick: they hold the sand grains together.","reveal_hint":"How could your barrier slow the waves down instead of blocking them?"},
  {"step":"skill","instructions":"Build a sand slope in a tray and pour 500 ml of water down it. Measure how much sand washes away by counting spoonfuls. Repeat with a flat card wall, a row of sticks and a mesh of string.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your beach barrier from above and from the side.","guidance":"Show where the waves hit, how your barrier slows them, and what holds the sand in place."},
  {"step":"build_and_test","instructions":"Build a beach in a tray and protect it with a barrier made from sticks, string, cloth, straws or stones. Make 20 waves by pushing the water with a flat piece of card.","test_criteria":["How much sand washes away compared to a beach with no barrier?","Does your barrier stay in place after 20 waves?","Improve one thing and test again. Did less sand wash away?"]},
  {"step":"celebrate_and_share","celebration_text":"Seaside Bay's beach survived the winter storms! The dunes are growing again, thanks to your barrier.","share_prompt":"Share your barrier and your sand results on the Ideas Wall. Which nature trick did you copy?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"scamper","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Measure how much sand washes away with different barriers, then build and improve your own."},
  {"age_tier":"12-18","title_override":"Biomimicry: Nature-Based Coastal Defence","summary":"Explain how wave energy moves sediment, compare reflective walls with rough permeable barriers, and link your design to living shorelines and mangrove restoration."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "keep-the-ice-pop-frozen",
            "Keep the Ice Pop Frozen",
            1,
            8,
            // steps JSON
            r#"[
  {"step":"brief","title":"Sports Day Meltdown!","story":"Leo's team runs the sports day stall, and the ice pops melt before the last race starts. There's no freezer on the field and no power. Can YOU design a reusable pouch that keeps an ice pop frozen for at least 45 minutes in the sun?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for keeping something frozen without a freezer?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature keep heat out? Animals in the coldest and hottest places on Earth have solved this without any machines. Let's look at their tricks!","clues":[{"text":"Polar bears have hollow guard hairs over thick underfur. The fur traps still air, so body heat barely leaks out.","image_url":null,"habitat":"arctic"},{"text":"Emperor penguins huddle in groups of thousands. Each bird has less of its body touching the icy wind, which can halve the heat it loses.","image_url":null,"habitat":"arctic"},{"text":"Camels keep thick fur on their backs in the desert. It blocks the sun's heat, so they sweat less than camels whose fur has been shaved.","image_url":null,"habitat":"desert"},{"text":"Arctic foxes curl up and wrap their bushy tail over their face, so less of their body touches the cold air.","image_url":null,"habitat":"arctic"}]},
  {"step":"design_secret","secret":"Heat travels from hot to cold in three ways: by touching (conduction), by moving air (convection) and by sunlight (radiation). Still, trapped air is a poor conductor, and a shiny surface bounces sunlight away. The best insulators stack layers that each block a different path.","reveal_hint":"Which of the three heat paths can each layer of your pouch block?"},
  {"step":"skill","instructions":"Run a fair test. Wrap three identical ice cubes: one in paper, one in bubble wrap and one in foil with cotton inside. Keep everything else the same and time how long each takes to melt. Record your results in a table: Material | Start time | Fully melted | Minutes.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw a cross-section of your pouch, as if you cut it in half.","guidance":"Label each layer and write which heat path it blocks: conduction, convection or radiation."},
  {"step":"build_and_test","instructions":"Build your pouch from fabric scraps, bubble wrap, foil, felt or cotton. Put one ice cube inside and a control cube on a plate beside it, both in the same sunny spot. Time both.","test_criteria":["Does your ice cube last at least three times longer than the control?","Change one thing, like adding a layer, and test again. How many extra minutes did it add?","Does the pouch close with no gaps and still fit in a school bag?"]},
  {"step":"celebrate_and_share","celebration_text":"The last runner crossed the finish line and the ice pops were still frozen! Your pouch saved sports day.","share_prompt":"Share your cross-section and your melting table on the Ideas Wall. Which heat path was hardest to block?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"mind_map","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Fair-test three insulating materials, then build a layered pouch that beats a control ice cube by at least 3x."},
  {"age_tier":"12-18","title_override":"Biomimicry: Designing a Layered Insulator","summary":"Relate conduction, convection and radiation to polar bear fur and penguin huddles; plot melt time against layer count and explain the diminishing returns."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-backpack-that-wont-stay-shut",
            "The Backpack That Won't Stay Shut",
            1,
            9,
            // steps JSON
            r#"[
  {"step":"brief","title":"Crayons Everywhere!","story":"Mia's backpack zip broke on the first day of term. Buttons pop open when she runs, and magnets are too weak once the bag is full. Can YOU invent a closer that holds a full bag shut, opens with one hand and still works after 20 uses?","image_url":null},
  {"step":"your_idea","prompt":"Got an idea for a fastener that grips hard but opens easily?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature hold on tight and still let go? Plants and animals grab, cling and release all the time. Let's see how!","clues":[{"text":"Burdock burrs are covered in hundreds of hooked spines that snag on fur. The seed rides away on a passing animal and drops off somewhere new.","image_url":null,"habitat":"forest"},{"text":"A bird's feather is held together by tiny hooks called barbules. When a feather splits, the bird zips it back together by running it through its beak.","image_url":null,"habitat":"sky"},{"text":"Each sucker on an octopus arm seals and grips on its own, and the octopus can release them one at a time.","image_url":null,"habitat":"ocean"},{"text":"Pea plants grab supports with curly tendrils. The coil works like a spring and holds on even in strong wind.","image_url":null,"habitat":"forest"}]},
  {"step":"design_secret","secret":"Lots of small holds add up to a strong grip, but each one lets go on its own. So a hook-and-loop fastener is strong when you pull straight, but easy to peel open one hook at a time. Georges de Mestral noticed burrs stuck to his dog in the 1940s and invented Velcro.","reveal_hint":"How could you make your closer strong when pulled, but easy to peel?"},
  {"step":"skill","instructions":"Test grip. Tape a burr, or a pipe cleaner bent into a hook, to a paper cup and hang it on felt, wool and cotton. Add coins to the cup until it falls. Record the number of coins for each fabric, then try peeling it off instead of pulling.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your closer at normal size, plus a zoomed-in view of the hooks and what they catch on.","guidance":"Show how it closes, how it opens with one hand, and which materials you'll use."},
  {"step":"build_and_test","instructions":"Make your closer from pipe cleaners, felt, paper clips, string or card, and fit it to a paper bag or pencil case. Fill the bag with coins or crayons.","test_criteria":["How many coins can the closed bag hold before it opens?","Can you open it with one hand in under 3 seconds?","After 20 open-and-close cycles, does it still hold?"]},
  {"step":"celebrate_and_share","celebration_text":"Mia sprinted across the playground and nothing fell out! Your closer is now part of her adventure.","share_prompt":"Share your closer and your coin results on the Ideas Wall. How many hooks did your design use?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"brainstorm","age_mode":"young"},
  {"kind":"brainstorm","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Measure how well hooks grip different fabrics, then build a one-hand fastener and test it over 20 cycles."},
  {"age_tier":"12-18","title_override":"Biomimicry: Hook-and-Loop Fasteners","summary":"Compare shear strength with peel strength, graph grip loss over repeated cycles, and explain why many weak hooks beat one strong clasp."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-train-that-went-boom",
            "The Train That Went BOOM",
            1,
            10,
            // steps JSON
            r#"[
  {"step":"brief","title":"BOOM Goes the Tunnel!","story":"Sunny Hills' new high-speed train makes a loud BOOM every time it leaves a tunnel, and people living nearby are complaining. The engineers think the shape of the train's nose is to blame. Can YOU redesign the nose to cut the boom, and still leave room for the driver?","image_url":null},
  {"step":"your_idea","prompt":"Do you already know what nose shape you'd try?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature move through air and water quietly? Some animals dive, swim and fly almost silently. Let's find out how!","clues":[{"text":"A kingfisher's long, wedge-shaped beak lets it dive from air into water with almost no splash, even though water is much denser than air.","image_url":null,"habitat":"jungle"},{"text":"Dolphins have smooth, rounded heads and bodies, so water flows past them with little resistance.","image_url":null,"habitat":"ocean"},{"text":"Owls have comb-like fringes on the front edge of their wings. They break up swirls of air, so owls fly almost silently.","image_url":null,"habitat":"sky"},{"text":"Shark skin is covered in tiny tooth-shaped scales that reduce drag as the shark swims.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"A train speeding into a tunnel squeezes the air ahead of it into a pressure wave, which bursts out of the far end as a boom. A long nose that slowly gets wider pushes the air aside a little at a time instead of all at once. In the 1990s, engineer Eiji Nakatsu reshaped Japan's Shinkansen bullet train like a kingfisher's beak. It became quieter, used about 15% less electricity and went 10% faster.","reveal_hint":"What would happen if your train pushed the air aside gradually instead of all at once?"},
  {"step":"skill","instructions":"Drop clay shapes of the same weight into a tall glass of water from the same height: a ball, a short cone and a long cone. Film each drop next to a ruler and measure how high the splash goes. Repeat three times and take the average.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your train nose from the side and from above.","guidance":"Add arrows showing how the air flows around it, and mark where the driver's cab goes."},
  {"step":"build_and_test","instructions":"Make three noses from clay or rolled paper, all the same weight. Test each one with the splash drop from the Skill step and record the average splash height.","test_criteria":["Which nose makes the lowest splash? Is it the longest one or the pointiest one?","Make your best nose 2 cm longer and test again. Did the splash get lower?","Is there still room for the driver's cab?"]},
  {"step":"celebrate_and_share","celebration_text":"The new train glides out of the tunnel with just a whoosh! The neighbours can finally sleep.","share_prompt":"Share your nose design and your splash table on the Ideas Wall. Which animal inspired your shape?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Measure splash height for three nose shapes, find the root cause of the boom with 5 Whys, and improve your best design."},
  {"age_tier":"12-18","title_override":"Biomimicry: The Kingfisher Bullet Train","summary":"Explain tunnel pressure waves, compare splash height against nose length-to-width ratio, and discuss the trade-off between a long nose and cab space."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "a-cool-house-for-grandma",
            "A Cool House for Grandma",
            1,
            11,
            // steps JSON
            r#"[
  {"step":"brief","title":"Grandma's House Is Too Hot!","story":"Grandma Rosa's small house reaches 35 °C inside on summer afternoons. She doesn't want an air conditioner because it's noisy and expensive to run. Can YOU design changes that help the house cool itself, using only air, shade and shape?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for cooling a house without a machine?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature stay cool without any power? Animals build homes and grow bodies that stay cool in scorching places. Let's investigate!","clues":[{"text":"Termite mounds have a tall chimney and tunnels. Warm air rises out of the top and pulls cooler air in lower down, so the nest stays close to the same temperature all day.","image_url":null,"habitat":"desert"},{"text":"Prairie dog burrows have one raised entrance and one flat one. Wind blowing over the raised one pulls fresh air through the tunnels.","image_url":null,"habitat":"grassland"},{"text":"Elephants' huge, thin ears are full of blood vessels. Flapping them lets heat escape into the air.","image_url":null,"habitat":"grassland"},{"text":"Desert snails have white shells that reflect most of the sunlight, keeping the snail inside much cooler.","image_url":null,"habitat":"desert"}]},
  {"step":"design_secret","secret":"Warm air is lighter than cool air, so it rises. If a building has a low opening and a high one, warm air escapes at the top and pulls cooler air in at the bottom. This is called the stack effect. Architect Mick Pearce used it for the Eastgate Centre in Harare, Zimbabwe, which uses about 90% less energy for cooling than similar buildings.","reveal_hint":"Where would you put openings so hot air can escape and cool air can come in?"},
  {"step":"skill","instructions":"Ask an adult to help you hold a thin tissue strip above a mug of hot water. Watch which way it moves. Then use a thermometer to compare the temperature just above the mug with the temperature 30 cm to the side.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw Grandma's house cut in half, like a dollhouse.","guidance":"Add arrows showing where cool air comes in and where warm air leaves. Show any shade or reflective surfaces too."},
  {"step":"build_and_test","instructions":"Turn two identical shoeboxes into houses. Give one low windows, a high vent and a white or foil roof, and leave the other closed. Put both in the sun with a thermometer inside, and read them every 5 minutes for 30 minutes.","test_criteria":["After 30 minutes, how many degrees cooler is your house than the closed one?","Which change matters most? Test the vent on its own, then the roof on its own.","Would rain still stay out? Show how the vents are covered."]},
  {"step":"celebrate_and_share","celebration_text":"Grandma's house is breezy, quiet and cool, and her cat is napping on the windowsill again!","share_prompt":"Share your house and your temperature chart on the Ideas Wall. Which change made the biggest difference?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Log temperatures in two model houses every 5 minutes and test which change, the vent or the roof, cools the most."},
  {"age_tier":"12-18","title_override":"Biomimicry: Passive Cooling and the Stack Effect","summary":"Graph temperature over time for each design, isolate variables one at a time, and compare your results to the Eastgate Centre's termite-inspired design."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "tobys-kite-is-stuck",
            "Toby's Kite Is Stuck",
            1,
            12,
            // steps JSON
            r#"[
  {"step":"brief","title":"Lost Under the Shed!","story":"Toby's kite slid under the garden shed, 60 cm back, into a gap only 5 cm high. Sticks just push it further in. Can YOU design a grabber that reaches into a narrow gap, picks up something flat and smooth, and lets it go again?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for a grabber?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature grip smooth surfaces? Some animals can walk up glass or catch prey in a flash. Let's find out how they hold on!","clues":[{"text":"A gecko's toes have millions of tiny hairs that split into even tinier tips. They touch the surface so closely that tiny forces between molecules add up, so a gecko can hang from glass by one toe.","image_url":null,"habitat":"jungle"},{"text":"Tree frogs have soft toe pads with a thin layer of mucus. They grip wet leaves the way a damp finger picks up paper.","image_url":null,"habitat":"jungle"},{"text":"A chameleon's tongue has a sticky, cup-shaped tip that grabs insects in a fraction of a second.","image_url":null,"habitat":"jungle"},{"text":"The tip of an elephant's trunk has finger-like parts that can pinch something as small as a peanut.","image_url":null,"habitat":"grassland"}]},
  {"step":"design_secret","secret":"The more of a surface you touch, the stronger your hold. Soft, bendy tips fill in the tiny bumps that a hard tip misses. A gecko's grip is also easy to release: when it tilts its hairs, the grip lets go. Engineers have used this to build climbing robots and grippers for space.","reveal_hint":"What soft material could touch as much of a smooth surface as possible?"},
  {"step":"skill","instructions":"Try to lift a playing card with a pencil tip, sticky tape, a damp sponge, reusable putty and a rubber glove fingertip. Rate each one from 1 to 5 for grip and for easy release, and record the scores in a table.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your grabber with its measurements.","guidance":"Label the handle, the reach and the gripping tip. Show how you make it let go."},
  {"step":"build_and_test","instructions":"Build a grabber from a ruler, cardboard tubes, string, straws and your best tip material. Put a card under a sofa or chair at least 40 cm back, then try to pull it out.","test_criteria":["How many times out of 10 can you pull the card out?","Does it work on three different flat things, like a card, a coin and a leaf?","Can you drop the object exactly where you choose?"]},
  {"step":"celebrate_and_share","celebration_text":"The kite is out from under the shed and flying high again! Toby says you're a genius.","share_prompt":"Share your grabber and your 10-try score on the Ideas Wall. What was your gecko-toe material?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"mind_map","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Score five tip materials for grip and release, then build a long-reach grabber and record its success rate out of 10."},
  {"age_tier":"12-18","title_override":"Biomimicry: Gecko-Inspired Grippers","summary":"Explain van der Waals forces and contact area, compare grip against release for each material, and design a gripper that switches between the two."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "special-delivery-from-the-treehouse",
            "Special Delivery from the Treehouse",
            1,
            13,
            // steps JSON
            r#"[
  {"step":"brief","title":"Messages Keep Crashing!","story":"Sam and Priya send messages between Sam's treehouse and Priya's garden below. Paper notes blow away, and anything heavier crashes down. Can YOU design a flyer that carries a paper-clip \"message\" down slowly and lands within 1 metre of a target?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for floating a message down gently?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature fall slowly and ride the wind? Plants can't walk, so many send their seeds flying. Let's look at how!","clues":[{"text":"A maple seed has one thin wing. As it falls, it spins like a helicopter blade, which can more than double its fall time.","image_url":null,"habitat":"forest"},{"text":"A dandelion seed has a crown of about 100 fine hairs. Air flows through the gaps and forms a steady swirl above it, so the seed can drift for kilometres.","image_url":null,"habitat":"grassland"},{"text":"Flying squirrels stretch a flap of skin between their front and back legs and glide more than 50 metres between trees.","image_url":null,"habitat":"forest"},{"text":"The Javan cucumber seed has a wide, paper-thin wing and glides like a tiny aircraft. It inspired some early glider designs.","image_url":null,"habitat":"jungle"}]},
  {"step":"design_secret","secret":"A falling object pushes air out of its way, and the air pushes back. That push is called drag. A spinning wing keeps meeting new air, so it keeps making drag and slows the fall. Engineers are testing maple-shaped drones and seed-sized sensors that drift down over forests.","reveal_hint":"How could your flyer keep pushing against the air all the way down?"},
  {"step":"skill","instructions":"Drop a flat sheet of paper, a crumpled sheet and a folded paper spinner from the same height. Time each one three times and work out the average. Which shape falls slowest, and why?","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your flyer with its measurements.","guidance":"Show where the message goes and which way the flyer spins or floats."},
  {"step":"build_and_test","instructions":"Build a spinner or parachute from paper, tissue or thread, and attach a paper clip as the message. Stand on the floor and drop it from your raised hand, from the same height every time.","test_criteria":["What is its average fall time over 3 drops, compared with a paper clip on its own?","Change one thing, like the wing length or where the clip goes, and test again. What changed?","How many of 5 drops land within 1 metre of a target?"]},
  {"step":"celebrate_and_share","celebration_text":"Priya caught the message and sent one back up! The treehouse post office is open for business.","share_prompt":"Share your flyer and your best fall time on the Ideas Wall. Which seed did you copy?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"brainstorm","age_mode":"young"},
  {"kind":"brainstorm","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Time three falling shapes, then build a seed-inspired flyer and improve its fall time by changing one thing at a time."},
  {"age_tier":"12-18","title_override":"Biomimicry: Seed Flight and Drag","summary":"Compare autorotation (maple) with parachuting (dandelion), plot fall time against wing length, and discuss how seed-inspired sensors could be spread over forests."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-shelf-that-keeps-falling-down",
            "The Shelf That Keeps Falling Down",
            1,
            14,
            // steps JSON
            r#"[
  {"step":"brief","title":"Books on the Floor Again!","story":"The class library shelf in Room 3 sags in the middle and dumps books on the floor. There's no money for a new one, but there's a big pile of scrap paper and cardboard. Can YOU design a shelf that holds as many books as possible, using as little paper as possible?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for a strong paper shelf?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature build strong things from very little material? Living things can't waste energy on heavy structures. Let's see how they stay strong and light!","clues":[{"text":"Honeybees build six-sided wax cells that fit together with no gaps. They hold the most honey with the least wax, and each wall supports its neighbours.","image_url":null,"habitat":"forest"},{"text":"Bird bones are hollow, with thin cross-braces inside like tiny bridges. They're light enough for flying and strong enough for landing.","image_url":null,"habitat":"sky"},{"text":"Bamboo is a hollow tube divided by solid walls called nodes. The nodes stop the tube from buckling, so bamboo can grow 30 metres tall.","image_url":null,"habitat":"jungle"},{"text":"The giant water lily's leaf is braced underneath by a web of ribs and can hold the weight of a small child. It inspired the roof of the Crystal Palace in London.","image_url":null,"habitat":"jungle"}]},
  {"step":"design_secret","secret":"Shape matters more than the amount of material. A flat sheet bends easily, but the same paper rolled into a tube or folded into hexagons spreads the load across many walls. Engineers call this the strength-to-weight ratio: how much a structure holds compared to how much it weighs. Aircraft floors and doors use honeycomb panels for this reason.","reveal_hint":"How could you turn flat paper into a shape where every wall helps hold the load?"},
  {"step":"skill","instructions":"Make four columns, each from one sheet of paper: round, square, triangle and hexagon. Stack books on each until it buckles, and record the number of books each shape held.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your shelf from the front and from above.","guidance":"Show the hidden structure inside and write how many sheets of paper it uses."},
  {"step":"build_and_test","instructions":"Build a shelf about 30 cm wide from paper, cardboard and tape. Add books one at a time until it sags 1 cm.","test_criteria":["How many books does it hold?","What's your score in books held per sheet of paper used?","Improve one thing and test again. Did your score go up?"]},
  {"step":"celebrate_and_share","celebration_text":"Room 3 has a brand-new library shelf, and it's full of honeycomb! The books stay put.","share_prompt":"Share your shelf and your books-per-sheet score on the Ideas Wall. Which shape made it strong?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"scamper","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Test four column shapes, then build a paper shelf and improve its books-per-sheet score."},
  {"age_tier":"12-18","title_override":"Biomimicry: Strength-to-Weight Structures","summary":"Compare buckling loads across column shapes, calculate strength-to-weight for your shelf, and explain why honeycomb panels are used in aircraft."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "will-it-rain-today",
            "Will It Rain Today?",
            1,
            15,
            // steps JSON
            r#"[
  {"step":"brief","title":"Raincoat or No Raincoat?","story":"Every morning Noor's little brother asks, \"Do I need my raincoat?\" Noor wants a weather helper that works with no batteries, no screen and no phone. Can YOU design an object that changes shape when the air gets damp, and changes back when it dries?","image_url":null},
  {"step":"your_idea","prompt":"Do you already know a material that reacts to damp air?","fork_to_step":6},
  {"step":"nature_clues","intro":"How does nature sense when the air gets damp? Some plants move without any muscles, just by reacting to water in the air. Let's discover how!","clues":[{"text":"Each pine cone scale has two layers of fibres that swell differently when they absorb moisture. In damp air the scales close to protect the seeds, and in dry air they open. This works even on cones that fell off the tree years ago.","image_url":null,"habitat":"forest"},{"text":"Wild wheat seeds have two long bristles that bend back and forth as the air gets damp and dry. Day after day, this rowing motion drills the seed into the soil.","image_url":null,"habitat":"grassland"},{"text":"The ice plant's seed capsule opens only when it gets wet, so its seeds are released when rain can wash them away and water them.","image_url":null,"habitat":"desert"},{"text":"Frogs' thin skin loses water fast in dry air, so many frogs are most active and loudest when the air is humid, often just before rain.","image_url":null,"habitat":"jungle"}]},
  {"step":"design_secret","secret":"A material that soaks up water from the air is called hygroscopic. If you glue a layer that swells onto a layer that doesn't, the pair has to bend to fit, just like a pine cone scale. Researchers use this two-layer trick to build panels that open and close building vents without any motors.","reveal_hint":"What if one side of your petal swelled in damp air and the other side didn't?"},
  {"step":"skill","instructions":"Put one pine cone in a cup of water and another on a sunny windowsill. Photograph both every 15 minutes for an hour, then swap them and repeat. Measure how wide each cone is in each photo.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw your weather flower twice: once in dry air and once in damp air.","guidance":"Label the layer that swells and the layer that stays the same."},
  {"step":"build_and_test","instructions":"Make petals by gluing tissue or thin paper onto one side of a strip of baking paper or plastic. Or build a pointer that a pine cone scale moves along a scale you draw. Put it in a steamy bathroom after a shower, then on a dry windowsill.","test_criteria":["How far does the petal tip move, in millimetres?","Can someone else tell \"damp\" from \"dry\" just by looking at it?","Does it still work after 3 damp-and-dry cycles?"]},
  {"step":"celebrate_and_share","celebration_text":"Noor's brother checks the weather flower every morning, and he hasn't been soaked once!","share_prompt":"Share your weather flower and a before-and-after photo on the Ideas Wall. Which plant did you copy?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"brainstorm","age_mode":"young"},
  {"kind":"brainstorm","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Measure how pine cones respond to damp and dry air, then build a two-layer petal and record how far it moves."},
  {"age_tier":"12-18","title_override":"Biomimicry: Hygroscopic Actuators","summary":"Explain hygroscopic bilayers and differential swelling, measure petal movement across repeated cycles, and compare with motor-free responsive building facades."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-guess-who-tree",
            "The Guess-Who Tree",
            1,
            16,
            // steps JSON
            r#"[
  {"step":"brief","title":"Twenty Questions, but Smarter","story":"Pixel the robot wants to guess ANY animal you're thinking of by asking only yes/no questions, and it wants to win in as few questions as possible. A bad first question wastes a turn! Can YOU build a question tree that guesses any of 8 animals in 3 questions or fewer?","image_url":null},
  {"step":"your_idea","prompt":"What is the smartest first yes/no question you could ask to guess any animal?","fork_to_step":6},
  {"step":"nature_clues","intro":"Computers can't \"just know\" an answer. They follow steps. Here's how people and real AI break a big choice into small ones.","clues":[{"text":"A doctor asks a patient questions one by one (\"Fever? Cough?\") to narrow down what's wrong. Each answer rules out lots of illnesses.","image_url":null,"habitat":null},{"text":"Scientists identify a mystery leaf with a \"key\": is the edge smooth, yes or no? Each answer cuts the choices down.","image_url":null,"habitat":null},{"text":"Email apps use decision trees to decide spam or not spam: does it contain a strange link? Is the sender unknown?","image_url":null,"habitat":null},{"text":"In the game Guess Who, the best players never guess a single face first. They ask questions that knock out half the board.","image_url":null,"habitat":null}]},
  {"step":"design_secret","secret":"This is a DECISION TREE, one of the oldest tools in AI. Each yes/no question splits a group into two smaller groups. The best question splits the group roughly in half, because it throws away the most wrong answers at once. With perfect half-splits, 3 questions can find 1 animal out of 8, and 10 questions can find 1 out of 1,024!","reveal_hint":"Which question removes more animals: \"Is it a zebra?\" or \"Does it have four legs?\""},
  {"step":"skill","instructions":"UNPLUGGED first: write 8 animals on cards and sort them with one yes/no question. Count the Yes pile and the No pile. Try 5 different questions and record which one splits the cards most evenly. Then open the Question Tree game below and try the same questions, watching the star meter for even splits.","skill_refs":[],"hints":["A good question splits your animals into two roughly equal groups.","Ask about a shared feature (legs? fur? lives in water?) before guessing a single animal."]},
  {"step":"sketch","prompt":"Plan your tree before you build it.","guidance":"Draw the tree on paper: your best first question at the top, then a follow-up question on each branch, until every animal sits alone at a tip. Mark the longest path, which is your worst case."},
  {"step":"build_and_test","instructions":"Build your whole tree in the Question Tree game, then press Play. Think of an animal and let your tree guess it, counting the questions. Play 5 rounds, then swap in a better question and play 5 more.","test_criteria":["Can your tree guess any of the 8 animals in 3 questions or fewer?","What is your AVERAGE number of questions over 5 rounds?","Swap your top question for a more even one and play again. Did your average drop?"],"hints":["Put the question that splits the animals most evenly at the very top.","Find your longest path. That's your worst case, and a more even question shortens it."]},
  {"step":"celebrate_and_share","celebration_text":"You built a decision tree, the same idea behind spam filters and game AI!","share_prompt":"Share your tree and your average number of questions. AI check: what could go wrong if a tree like yours decided something important, and someone's answer didn't fit any branch?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"brainstorm","age_mode":"young"},
  {"kind":"brainstorm","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Sort cards with yes/no questions, build a tree that guesses 8 animals in 3 questions, and cut your average by reordering."},
  {"age_tier":"12-18","title_override":"Decision Trees and Information Gain","summary":"Explain why an even split is best (information gain), compare worst-case and average depth, and work out how many questions 1,000 animals would need."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "teach-the-machine-to-see",
            "Teach the Machine to See",
            1,
            17,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Robot That Can't Tell Apples from Oranges","story":"Pixel the robot wants to sort fruit at the school kitchen, but it guesses randomly and gets almost everything wrong. Last week you wrote the rules yourself. This time, nobody writes rules: Pixel must LEARN from examples you show it. Can YOU train Pixel to tell two things apart, and get it above 80% correct on pictures it has never seen?","image_url":null},
  {"step":"your_idea","prompt":"How would YOU teach a friend who has never seen an orange to recognise one?","fork_to_step":6},
  {"step":"nature_clues","intro":"Machine learning is everywhere. Here's how people and real AI learn to recognise things from examples.","clues":[{"text":"You can spot your best friend in a crowd in a split second, because you've seen their face thousands of times from every angle.","image_url":null,"habitat":null},{"text":"Phone cameras learn to find faces and pets by training on millions of example photos.","image_url":null,"habitat":null},{"text":"Doctors are testing AI that learns to spot diseases in X-rays after seeing thousands of labelled examples.","image_url":null,"habitat":null},{"text":"Plant-ID apps learn a flower's features, like petal shape, colour and leaf edges, from huge sets of labelled photos.","image_url":null,"habitat":null}]},
  {"step":"design_secret","secret":"AI learns from EXAMPLES, not rules. It looks for FEATURES, little clues like colour, shape or texture, that separate one group from another. More examples help, but VARIED examples help most. The real test is always pictures the AI has never seen before, called test data. If you test it on its training pictures, it's like marking your own homework!","reveal_hint":"Why is it unfair to test the machine on the same pictures it learned from?"},
  {"step":"skill","instructions":"UNPLUGGED first: make a feature-checklist card with 4 yes/no features, like \"round?\", \"orange colour?\", \"bumpy skin?\" and \"has a stalk?\". Score 10 fruit pictures and let the card vote. Then open the Machine Trainer below and make two classes. Use photos of objects only, never people's faces.","skill_refs":[],"hints":["Features are clues you can answer for every picture, like colour, shape and texture.","Keep some pictures aside. You'll need new ones for the real test."]},
  {"step":"sketch","prompt":"Plan your data before you collect it.","guidance":"Write down: your two classes, how many training pictures of each (aim for 20), and how you'll make them VARIED, with different lighting, angles, sizes and backgrounds. Then set aside 10 NEW pictures for testing."},
  {"step":"build_and_test","instructions":"Train the Machine Trainer with your pictures, then test it on the 10 pictures you set aside. Record each guess. Then add more varied examples, retrain, and test again on the same 10.","test_criteria":["What is your accuracy on the test pictures? (Correct ÷ total, like 7 out of 10 = 70%.)","After adding more varied examples, did your accuracy go up?","Find one picture the machine got wrong and explain WHY, based on its features."],"hints":["Count only the ones it got RIGHT, then divide by how many you tested.","If it keeps missing one kind, add more examples of that kind."]},
  {"step":"celebrate_and_share","celebration_text":"You trained a machine to see! You're now an AI teacher, and you found out that good examples make a smart machine.","share_prompt":"Share your before-and-after accuracy. AI check: your classifier learned from YOUR pictures. Would it still work on someone else's photos?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"mind_map","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Train a two-class classifier, test it on new pictures, and raise its accuracy by adding varied examples."},
  {"age_tier":"12-18","title_override":"Training an Image Classifier","summary":"Separate training and test data, compare small and varied training sets, track accuracy across rounds, and explain which features cause mistakes."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "spot-the-fake",
            "Spot the Fake",
            1,
            18,
            // steps JSON
            r#"[
  {"step":"brief","title":"Why Does the AI Keep Getting Fooled?","story":"Pixel's new fruit sorter passed its test, but in the school kitchen it keeps calling green apples \"not apples\". It isn't broken. It learned something unfair from its examples. Can YOU find out what Pixel secretly learned, prove it with data, and fix it?","image_url":null},
  {"step":"your_idea","prompt":"Why do you think Pixel is being fooled by green apples?","fork_to_step":6},
  {"step":"nature_clues","intro":"Bias happens when an AI learns from one-sided examples. Here's how it shows up in the real world.","clues":[{"text":"Some early face-detection systems worked worse on darker skin, because they had mostly been trained on lighter-skinned faces.","image_url":null,"habitat":null},{"text":"Voice assistants have often struggled with some accents, because they heard fewer examples of them while learning.","image_url":null,"habitat":null},{"text":"A husky-or-wolf classifier was once found to be \"cheating\": it had learned that snow in the background meant wolf.","image_url":null,"habitat":null},{"text":"Fair AI teams test their systems on every group of users and fix the data when one group gets worse results.","image_url":null,"habitat":null}]},
  {"step":"design_secret","secret":"An AI is only as fair as its examples. If it only ever sees RED apples, it secretly learns \"apple = red\", so a green apple fools it. This is called BIAS, and it comes from one-sided data. To find it, test each group separately. To fix it, add the missing examples, not just more of the same.","reveal_hint":"If the machine only ever saw one colour of apple, what has it REALLY learned?"},
  {"step":"skill","instructions":"UNPLUGGED first: make a card classifier trained only on red apples, then test it on a green apple and a red ball. Watch it fail both ways. Then in the Machine Trainer, train an \"apple\" class on red apples only.","skill_refs":[],"hints":["If you only show red apples, the machine may secretly learn \"apple = red\".","Predict which test picture will fool it before you try."]},
  {"step":"sketch","prompt":"Plan a fair test.","guidance":"Make a table with a row for each group, like red apples, green apples and red balls. Predict the accuracy for each group, then plan the balanced training set that would fix the problem."},
  {"step":"build_and_test","instructions":"Test the biased classifier on each group separately and record the accuracy per group. Then add the missing examples, retrain, and test each group again.","test_criteria":["What is the accuracy for each group with the biased data? Which group does worst?","After balancing the data, how much did the worst group improve?","Explain in one sentence what bias your data had and how you fixed it."],"hints":["Measure each group separately. An overall score can hide a group that does badly.","Ask: what kind of example was missing from the training pile?"]},
  {"step":"celebrate_and_share","celebration_text":"You found the AI's blind spot AND fixed it. That's exactly what people who build fair AI do in the real world.","share_prompt":"Share your group-by-group accuracy, before and after. AI check: can you think of a real AI where unfair data could hurt someone?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Train a biased classifier, measure accuracy for each group, then balance the data and measure again."},
  {"age_tier":"12-18","title_override":"Bias and Fairness in Machine Learning","summary":"Design a biased dataset, measure the accuracy gap between groups, balance the data to close it, and discuss a real-world case of AI bias."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "train-your-pet-algorithm",
            "Train Your Pet Algorithm",
            1,
            19,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Robot Mouse and the Cheese","story":"Pixel has a new pet: a robot mouse in a maze. Nobody gives it a map or examples. It just tries moves, and you reward the good ones. Can YOU design a reward system that teaches the mouse the shortest path to the cheese, and avoids the traps?","image_url":null},
  {"step":"your_idea","prompt":"How do you train a puppy to do a new trick? Could the same idea train a robot?","fork_to_step":6},
  {"step":"nature_clues","intro":"Some AI learns by trial and error, collecting rewards. Here's where you can find it.","clues":[{"text":"A puppy learns \"sit\" because sitting earns a treat. Behaviour that gets rewarded happens more often.","image_url":null,"habitat":null},{"text":"Game-playing AIs learned chess and Go by playing millions of games against themselves, earning a reward only for winning.","image_url":null,"habitat":null},{"text":"Robots learn to walk by trial and error in computer simulations, rewarded for every step they stay upright.","image_url":null,"habitat":null},{"text":"Video game characters controlled by AI learn which moves earn points and which lose lives.","image_url":null,"habitat":null}]},
  {"step":"design_secret","secret":"This is REINFORCEMENT LEARNING. The AI tries moves, earns a REWARD for good ones and a penalty for bad ones, and slowly builds up a map of which moves pay off. Nobody tells it the answer. The rewards you choose decide what it learns, so a badly chosen reward teaches the wrong thing! It also has to balance EXPLORING new paths with using the best path it already knows.","reveal_hint":"If the cheese is worth +10 and a wasted step costs -1, which paths will the mouse start to prefer?"},
  {"step":"skill","instructions":"UNPLUGGED first: draw a 5×5 grid, write a reward number on each square, and move a paper mouse toward higher numbers. Then open the Reward Maze game below, place the cheese and press \"Run a try\". Watch the mouse wander at first, then start preferring moves that paid off.","skill_refs":[],"hints":["Give the cheese a big reward and wasted moves a small or negative one.","The mouse should prefer moves that lead to more reward over time."]},
  {"step":"sketch","prompt":"Design your maze world and its rewards.","guidance":"Place the start, the cheese, a wall and a trap. Choose rewards, like cheese +10, wasted step -1 and trap -5. Before you run it, predict the path the mouse should learn."},
  {"step":"build_and_test","instructions":"Run 5 tries in the Reward Maze and record the steps each try takes. Then change ONE reward, predict what will happen, and run 5 more tries.","test_criteria":["Compare the steps taken in try 1 and try 5. Did the mouse get faster?","Does it learn to avoid the trap?","Change one reward and predict the result first. Were you right?"],"hints":["Compare the steps in try 1 with try 5. Is it fewer?","If it never improves, make the cheese reward bigger than the wasted-step penalty."]},
  {"step":"celebrate_and_share","celebration_text":"Your pet algorithm learned to find the cheese by rewards alone! That's how AIs learn to play games and control robots.","share_prompt":"Share your maze and your steps-per-try chart. AI check: what could go wrong if you rewarded the wrong thing, like rewarding speed but not safety?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"scamper","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Design rewards for a maze, record steps per try, and test how changing one reward changes what the mouse learns."},
  {"age_tier":"12-18","title_override":"Reinforcement Learning by Hand","summary":"Set rewards and a simple update rule, run several episodes, graph learning over time, and discuss exploration versus exploitation."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "bring-it-to-life",
            "Bring It to Life!",
            1,
            20,
            // steps JSON
            r#"[
  {"step":"brief","title":"Doodle Wants to Dance","story":"Doodle is a little sketch who dreams of dancing, but stuck on the page, it can't move. Animators draw the big poses and then fill in lots of in-between pictures, which takes ages. Today, AI can guess those in-betweens for them. It's one of the ways AI \"generates\" new pictures and videos. Can YOU be the AI: bring Doodle to life by predicting the frames in between?","image_url":null},
  {"step":"your_idea","prompt":"If you know where a bouncing ball starts and lands, how could you work out where it is in between?","fork_to_step":6},
  {"step":"nature_clues","intro":"Generative AI makes new content by predicting what comes next. Here are some examples.","clues":[{"text":"Films and cartoons are really lots of still pictures, called frames, shown so fast your brain blends them into motion.","image_url":null,"habitat":null},{"text":"Some video apps use AI to create extra in-between frames, turning a jerky video into smooth slow motion.","image_url":null,"habitat":null},{"text":"Text AI predicts the next word, one word at a time, based on patterns from huge amounts of text it has read.","image_url":null,"habitat":null},{"text":"Image AI creates new pictures by learning patterns from millions of examples. It can also make mistakes, like extra fingers!","image_url":null,"habitat":null}]},
  {"step":"design_secret","secret":"Generative AI doesn't copy. It PREDICTS what comes next, based on patterns it learned from examples. To predict an in-between frame, it looks at the frames before and after and guesses the smoothest path. Because AI can make mistakes and can make fake things look real, anything made by AI should be LABELLED as AI-generated. Idea Pop does this too!","reveal_hint":"Look at the frame before and the frame after. What pattern tells you where the ball is in between?"},
  {"step":"skill","instructions":"UNPLUGGED first: draw a ball at the top of a sticky note and at the bottom of another. These are your keyframes. Now PREDICT 3 in-between frames, then flip them. Then open the Animation Studio below, add your keyframes, and draw the in-betweens you predicted.","skill_refs":[],"hints":["Start with just two keyframes, where your thing STARTS and where it ENDS. Then predict the middle.","Move your object only a LITTLE between frames. Small changes make smooth motion."]},
  {"step":"sketch","prompt":"Storyboard your animation.","guidance":"Draw 3 keyframes for one simple action, like a bounce, a jump or a flower opening. Mark how many in-betweens you'll predict between each pair, and write the pattern you'll follow, like \"slower at the top\"."},
  {"step":"build_and_test","instructions":"In the Animation Studio, add your keyframes and your predicted in-betweens, then play it. Fix the jerky parts by predicting more frames there. Use drawings or photos of objects only, never faces.","test_criteria":["Does it play as smooth motion? Count your keyframes and in-betweens.","Find the jerkiest moment, predict 2 more frames there, and play again. Is it smoother?","Ask a friend to spot which frames were keyframes and which were predicted. Could they tell?"],"hints":["If a move looks jumpy, you usually need more frames in that spot, not faster playback.","Keep the paper or camera still so only your object moves between frames."]},
  {"step":"celebrate_and_share","celebration_text":"Doodle is dancing! You predicted frames the way generative AI does, and you brought a drawing to life.","share_prompt":"Share your animation, and label which frames you predicted. AI check: why is it important to label pictures and videos made by AI?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"brainstorm","age_mode":"young"},
  {"kind":"brainstorm","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"10-12","title_override":null,"summary":"Draw keyframes, predict the in-between frames like a generative AI, and smooth out the jerky parts."},
  {"age_tier":"12-18","title_override":"Generative AI and Frame Prediction","summary":"Explain how generative models predict from patterns, compare your predicted frames with evenly spaced ones (easing), and discuss labelling and deepfakes."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
    ];

    for (slug, title, season, week, steps_json, tools_json, variants_json, is_premium) in challenges
    {
        let steps_val: serde_json::Value = serde_json::from_str(steps_json)?;
        let tools_val: serde_json::Value = serde_json::from_str(tools_json)?;
        let variants_val: serde_json::Value = serde_json::from_str(variants_json)?;

        sqlx::query(
            r#"INSERT INTO challenges
               (title, slug, season, week_number, xp_reward, steps, tools, age_tier_variants, is_premium)
               VALUES ($1, $2, $3, $4, 20, $5, $6, $7, $8)
               ON CONFLICT (slug) DO UPDATE
               SET title = EXCLUDED.title,
                   season = EXCLUDED.season,
                   week_number = EXCLUDED.week_number,
                   xp_reward = EXCLUDED.xp_reward,
                   steps = EXCLUDED.steps,
                   tools = EXCLUDED.tools,
                   age_tier_variants = EXCLUDED.age_tier_variants,
                   is_premium = EXCLUDED.is_premium"#,
        )
        .bind(title)
        .bind(slug)
        .bind(season)
        .bind(week)
        .bind(sqlx::types::Json(&steps_val))
        .bind(sqlx::types::Json(&tools_val))
        .bind(sqlx::types::Json(&variants_val))
        .bind(is_premium)
        .execute(pool)
        .await?;
    }
    println!("challenges seeded ({} entries)", challenges.len());
    Ok(())
}
