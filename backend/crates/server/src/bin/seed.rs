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
  {"step":"brief","title":"Max Can't Get to School!","story":"Max the rabbit wakes up and discovers the old wooden bridge over the river has collapsed. All his friends are waiting on the other side — and today is the science fair! Can YOU help Max find a way to cross safely?","image_url":null},
  {"step":"your_idea","prompt":"Do you already have an idea for how Max could cross the river?","fork_to_step":6},
  {"step":"nature_clues","intro":"Nature has solved river-crossing problems for millions of years. Let's look for clues!","clues":[{"text":"Water striders have wide, waxy feet that spread their weight across the surface — they never sink!","image_url":null,"habitat":"jungle"},{"text":"Beavers build log dams to block rivers and create calm ponds behind them.","image_url":null,"habitat":"jungle"},{"text":"Mangrove tree roots tangle together and trap mud, building new land in the water.","image_url":null,"habitat":"jungle"},{"text":"Coconuts float for months! Their thick husk traps air and keeps the seed dry.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"Surface tension lets water stick to itself. A wide, flat object spreads weight across many water molecules — that's why a paperclip can float on still water even though metal is heavy!","reveal_hint":"Think about how you could spread Max's weight as broadly as possible…"},
  {"step":"skill","instructions":"Watch how you can make a small ball of modelling clay sink, then flatten the same clay into a boat shape and make it float. Weight hasn't changed — shape has! Experiment with different widths and depths to see what holds the most cargo before sinking.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw Max's crossing solution — a bridge, a raft, stepping stones, or your own invention!","guidance":"Show the materials you would use and how they connect. Add labels for the most important parts."},
  {"step":"build_and_test","instructions":"Build a small model of your crossing using cardboard, sticks, foil, or anything at home. Then test it by placing a small coin or pebble on it over a bowl of water.","test_criteria":["Does it hold at least one 'passenger' (coin) without sinking?","Does it stay stable when you gently push the water to create tiny waves?","Could Max step onto it from the bank — is there a clear entry point?"]},
  {"step":"celebrate_and_share","celebration_text":"Max made it to the science fair — and won first prize for Most Creative Solution! Your bridge/raft/crossing idea is now part of Max's adventure forever.","share_prompt":"Take a photo of your model and share it on the Ideas Wall — which animal's trick inspired your design?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Focus on floating and surface area — build a wide raft from natural materials."},
  {"age_tier":"10-12","title_override":null,"summary":"Compare bridge vs. raft solutions; measure load capacity and stability."},
  {"age_tier":"12-18","title_override":"Engineering Max's Crossing","summary":"Apply truss and arch bridge principles; calculate load-per-unit-area and compare to surface tension data."}
]"#,
            false, // free — the intro mission
        ),
        (
            "the-forest-picnic-problem",
            "The Forest Picnic Problem",
            1,
            2,
            // steps JSON
            r#"[
  {"step":"brief","title":"Rain on the Way — Picnic in Danger!","story":"The Rossi family has been planning their forest picnic for weeks. They've packed sandwiches, juice boxes, and a birthday cake. But this morning the sky turned grey and the forecast says: 40% chance of showers. They won't cancel — they just need a shelter smart enough to keep everything dry. That's where YOU come in!","image_url":null},
  {"step":"your_idea","prompt":"Got an idea for a portable, forest-friendly rain shelter?","fork_to_step":6},
  {"step":"nature_clues","intro":"Animals have been keeping dry for millions of years without umbrellas. Let's steal their best ideas!","clues":[{"text":"The lotus leaf is superhydrophobic — water droplets bead up and roll right off without wetting the surface at all.","image_url":null,"habitat":"jungle"},{"text":"A woodpecker's nest hole faces downward so rain can't drip inside.","image_url":null,"habitat":"jungle"},{"text":"Desert beetles tilt their backs into the wind to collect water droplets from fog onto bumpy surfaces — then roll the water to their mouths.","image_url":null,"habitat":"desert"},{"text":"Bird feathers have tiny hooks (barbules) that zip the feather into a nearly waterproof mat.","image_url":null,"habitat":"sky"}]},
  {"step":"design_secret","secret":"The lotus effect works because the surface is covered in microscopic waxy bumps. Water droplets sit on top of these bumps (touching only the tips) and slide off carrying dirt with them. This is called superhydrophobicity!","reveal_hint":"What if you could make your shelter surface behave like a lotus leaf — or at least encourage water to run away from the picnic?"},
  {"step":"skill","instructions":"Test three surfaces for waterproofing: plain paper, wax-coated paper (rub a candle on it), and plastic wrap. Drip water on each and observe. Which repels best? Which absorbs? Record your results in a simple table: Surface | Beads? | Absorbs? | Verdict.","skill_refs":[]},
  {"step":"sketch","prompt":"Design the Rossi family's perfect forest shelter — it should be quick to set up, use natural or recycled materials, and shed rain away from the picnic area.","guidance":"Mark which surfaces are your 'lotus layer'. Show how rain flows off and away. Include a side view and a top view."},
  {"step":"build_and_test","instructions":"Build a model shelter (a small tent or lean-to shape) using materials from around your home. Then pour a tablespoon of water on the roof and watch what happens.","test_criteria":["Does water run off rather than pool?","Is the picnic area underneath dry after the pour?","Would this shelter survive a gust of wind — is it stable?"]},
  {"step":"celebrate_and_share","celebration_text":"The birthday cake stayed perfectly dry and the picnic was the best the Rossi family ever had! Your shelter design protected the day.","share_prompt":"Share your waterproof shelter design on the Ideas Wall — which nature trick did you borrow, and what material was your secret weapon?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Build a simple lean-to shelter from sticks and leaves; focus on slope direction and drainage."},
  {"age_tier":"10-12","title_override":null,"summary":"Compare materials for waterproofing; measure how much water drains vs. pools in different designs."},
  {"age_tier":"12-18","title_override":"Biomimicry: Designing a Superhydrophobic Shelter","summary":"Research the lotus effect and contact angle; design a shelter surface that maximises water roll-off using the principle of superhydrophobicity."}
]"#,
            true, // premium — unlocks with a family subscription
        ),
        (
            "teach-the-machine-to-see",
            "Teach the Machine to See",
            1,
            3,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Robot That Can't Tell Cats from Dogs","story":"Meet Pixel, a friendly robot who wants to sort photos into 'cats' and 'dogs' — but right now it guesses randomly and gets almost everything wrong! Computers can't magically recognise things; SOMEONE has to teach them, using examples. Your mission: train a 'machine brain' to tell two things apart (cats vs dogs, thumbs-up vs thumbs-down, apples vs oranges) and see how good it gets.","image_url":null},
  {"step":"your_idea","prompt":"How would YOU teach a friend who has never seen a cat to recognise one? Do you already have an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Brains are the best learning machines we know. Let's see how living brains learn to recognise things.","clues":[{"text":"You can spot your best friend in a crowd in a split second — because you've seen their face thousands of times.","image_url":null,"habitat":"jungle"},{"text":"A newborn duckling learns what 'mum' looks like from the very first moving thing it sees — then follows it everywhere.","image_url":null,"habitat":"jungle"},{"text":"Honeybees learn which flowers have the best nectar by visiting them again and again, remembering colour and shape.","image_url":null,"habitat":"sky"},{"text":"A guide-dog puppy isn't born knowing its job — it practises with hundreds of examples before it gets good.","image_url":null,"habitat":"jungle"}]},
  {"step":"design_secret","secret":"AI learns from EXAMPLES, not rules. The more examples you show it — and the more VARIED they are — the smarter it gets. Show it one-sided examples and it gets fooled. This is called machine learning, and choosing good examples is the whole secret.","reveal_hint":"Think about how many different cats a friend would need to see before they could recognise ANY cat…"},
  {"step":"skill","instructions":"Learn about FEATURES — the little clues a classifier uses (pointy ears? whiskers? barks? round or oval?). UNPLUGGED: make a paper 'feature-checklist' classifier — a card that scores each mystery picture on 4 features and votes cat or dog. PLUGGED (optional): open the Machine Trainer below, make two classes, and get ready to train it with about 20 images each.","skill_refs":[],"hints":["Think about what makes a cat a cat — ears, whiskers, tail. Those are its 'features'.", "Pick features you can answer yes/no for every picture."]},
  {"step":"sketch","prompt":"Pick your two categories and PLAN your examples before you collect them.","guidance":"Write down: What two things am I sorting? How many examples of each will I gather? How will I make them VARIED (different colours, angles, sizes)? A plan with varied examples beats a big pile of look-alikes."},
  {"step":"build_and_test","instructions":"UNPLUGGED: run 10 mystery cards through your feature-checklist classifier and record each guess. PLUGGED (optional): train the Machine Trainer with your images, then test it on NEW pictures it has never seen. Either way, count how many it got right.","test_criteria":["Measure your accuracy: correct ÷ total (e.g. 7 out of 10 = 70%).","Now add MORE and MORE VARIED examples and test again — did your accuracy go up?","Find at least one picture the machine got wrong and work out WHY."],"hints":["Count only the ones it got RIGHT, then divide by how many you tested.", "If it keeps missing one kind, add more examples of that kind."]},
  {"step":"celebrate_and_share","celebration_text":"You just trained a machine to see! You're now an AI teacher — and you discovered that good examples make a smart machine.","share_prompt":"Post your best accuracy score AND one example where the AI got fooled. Was your training data one-sided?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Sort two easy categories. Focus on collecting LOTS of varied examples and counting how many the machine gets right."},
  {"age_tier":"10-12","title_override":null,"summary":"Measure accuracy as a percentage, improve it by adding varied data, and explain one case where the classifier was fooled."},
  {"age_tier":"12-18","title_override":"Training an Image Classifier","summary":"Compare balanced vs. small training sets, track accuracy across rounds, and reason about which features drive misclassifications."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "the-guess-who-tree",
            "The Guess-Who Tree",
            1,
            4,
            // steps JSON
            r#"[
  {"step":"brief","title":"Twenty Questions… but Smarter","story":"Pixel the robot wants to guess ANY animal you're thinking of by asking only yes/no questions — and it wants to win in as few questions as possible. But a bad first question wastes a turn! Your mission: build a question tree that guesses an animal in the fewest questions.","image_url":null},
  {"step":"your_idea","prompt":"What is the SMARTEST first yes/no question you could ask to guess any animal? Got an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Nature loves branching — big things split into smaller and smaller groups. Let's look for the pattern.","clues":[{"text":"A river starts as one big flow, then splits into streams, then tiny trickles — each split sends water a different way.","image_url":null,"habitat":"ocean"},{"text":"A tree trunk divides into big branches, then twigs — every fork narrows down where a leaf ends up.","image_url":null,"habitat":"jungle"},{"text":"Scientists identify a mystery leaf with a 'key': is the edge smooth? yes/no. Each answer cuts the choices in half.","image_url":null,"habitat":"jungle"},{"text":"A family tree branches from grandparents down to you — following the branches finds exactly one person.","image_url":null,"habitat":"jungle"}]},
  {"step":"design_secret","secret":"This is a DECISION TREE — the way lots of AI makes choices. Each yes/no question splits a big group into smaller ones. The BEST question is the one that splits the group most evenly (roughly in half), because that throws away the most wrong answers at once and wins in the fewest guesses.","reveal_hint":"Which question removes MORE animals: 'Is it a zebra?' or 'Does it have four legs?'"},
  {"step":"skill","instructions":"See how ONE good question cuts a big group in half. Warm-up in the Question Tree game below: tap a yes/no question and watch the animals split into a Yes group and a No group — the star meter shows how EVEN your split is, and even splits are the smartest. (No screen? Write 8 animals on cards and sort them by a yes/no question instead.)","skill_refs":[],"hints":["A good question splits your animals into two roughly equal groups.","Ask about a shared feature (legs? fur? water?) before guessing a single animal."]},
  {"step":"sketch","prompt":"Pick the smartest FIRST question for your tree.","guidance":"In the Question Tree game, try different questions as your top split and watch the star meter. The one that splits the animals most evenly — closest to half and half — is the smartest start, because it throws away the most wrong answers at once. Then plan a follow-up question for each branch so every animal ends up alone at the tip."},
  {"step":"build_and_test","instructions":"Build your whole tree in the Question Tree game: keep adding yes/no questions to each branch until every animal sits alone at the end of a path. Then press Play — think of an animal and let your tree guess it, counting the questions. Play a few rounds. (No screen? Have a friend secretly pick an animal and follow your paper tree, counting the questions.)","test_criteria":["Can your tree guess any of the 8 animals in 3 questions or fewer?","What is your AVERAGE number of questions over 5 rounds?","Swap your top question for a more even one and play again — did your average drop?"],"hints":["Put the question that splits the animals most evenly at the very top.","Find your longest path — that's your worst case. A more even question shortens it."]},
  {"step":"celebrate_and_share","celebration_text":"You built a decision tree — the same idea powering everything from spam filters to game AIs! Fewer questions means a smarter tree.","share_prompt":"Share your finished tree and your best score — the fewest questions it took to guess an animal. What was your single smartest splitting question?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Build a yes/no question tree for 8 animals and try to guess each one in a few questions."},
  {"age_tier":"10-12","title_override":null,"summary":"Measure the average number of questions and rearrange the tree so the best splitting question comes first."},
  {"age_tier":"12-18","title_override":"Decision Trees & Information Gain","summary":"Reason about why an even split is best (information gain), and compare worst-case vs. average depth as you reorder questions."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "train-your-pet-algorithm",
            "Train Your Pet Algorithm",
            1,
            5,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Robot Mouse and the Cheese","story":"Pixel has a new pet: a robot mouse stuck in a grid, trying to reach the cheese. The mouse doesn't get a map — it just tries moves, and you reward the good ones. Your mission: 'train' the mouse with rewards until it learns the best path to the cheese.","image_url":null},
  {"step":"your_idea","prompt":"How do you train a puppy to do a new trick? Could the same idea train a robot? Got an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Animals learn by trying things and remembering what paid off. Let's watch reward-learning in the wild.","clues":[{"text":"A puppy learns 'sit' because sitting earns a treat — behaviour that gets rewarded happens more often.","image_url":null,"habitat":"jungle"},{"text":"A crow tries different ways to crack a nut; the trick that works is the one it repeats tomorrow.","image_url":null,"habitat":"sky"},{"text":"A mouse in a maze slowly stops taking dead ends because they never lead to food.","image_url":null,"habitat":"jungle"},{"text":"Bees keep returning to the flower bed that gave the most nectar last time.","image_url":null,"habitat":"sky"}]},
  {"step":"design_secret","secret":"This is REINFORCEMENT LEARNING. The AI tries moves, earns a REWARD for good ones and little or nothing for bad ones, and slowly builds up a 'map' of which moves pay off. Over many tries, it learns the path that earns the most reward — no one ever told it the answer directly.","reveal_hint":"If reaching the cheese is worth +10 and bumping a wall is worth 0, which moves will the mouse start to prefer?"},
  {"step":"skill","instructions":"See how REWARDS can teach without giving a map. Warm-up in the Reward Maze game below: put the cheese on the grid and press 'Run a try' — watch the mouse wander at first, then slowly start preferring the moves that earned reward. (No screen? Draw a grid, write a reward number on each square, and nudge a paper 'mouse' toward the higher numbers by hand.)","skill_refs":[],"hints":["Give the cheese a big reward and wasted moves a small or negative one.","The mouse should prefer moves that lead to more reward over time."]},
  {"step":"sketch","prompt":"Set up your maze world.","guidance":"In the Reward Maze game, place the START and the CHEESE, add a wall or a trap or two, and set the rewards (for example cheese +10, a wasted step -1, a trap -5). Before you run it, predict which path the mouse SHOULD learn."},
  {"step":"build_and_test","instructions":"Press 'Run a try' several times and watch the mouse learn — the path it prefers should get shorter each round. Compare how many steps it took on try 1 versus try 5. Then change a reward, or move a wall, and run again to watch it re-learn. (No screen? Run your paper mouse for several rounds, nudging it toward higher-reward moves and recording the steps.)","test_criteria":["Compare TRIES to reach the cheese in round 1 vs. round 5 — did it get faster?","Does the mouse eventually avoid the traps and dead ends?","Change one reward number, predict what happens, then run it and check."],"hints":["Compare steps in round 1 with round 5 — is it fewer?","If it never improves, make the cheese reward bigger than the wasted-move penalty."]},
  {"step":"celebrate_and_share","celebration_text":"Your pet algorithm learned to fetch the cheese — by rewards alone! That's how AIs learn to play games and control robots.","share_prompt":"Share your maze and how many tries it took the mouse to learn the best path. Which reward change made the biggest difference?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Move a token mouse around a grid and reward it for reaching the cheese; watch it get faster."},
  {"age_tier":"10-12","title_override":null,"summary":"Keep a reward table, count tries per round, and show the path improving as rewards guide the mouse."},
  {"age_tier":"12-18","title_override":"Reinforcement Learning by Hand","summary":"Assign rewards and a simple update rule, run several episodes, and discuss exploration vs. exploiting the best-known path."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "spot-the-fake",
            "Spot the Fake",
            1,
            6,
            // steps JSON
            r#"[
  {"step":"brief","title":"Why Does the AI Keep Getting Fooled?","story":"Pixel trained a new classifier — but it keeps making silly mistakes, calling green apples 'not apples' and missing them completely. Something about how it learned is unfair. Your mission: build an AI on purpose-bad, one-sided examples, watch it get fooled, then FIX it by fixing the data.","image_url":null},
  {"step":"your_idea","prompt":"Have you ever been tricked by something that looked like something else? How did the trick work? Got an idea about why Pixel is fooled?","fork_to_step":6},
  {"step":"nature_clues","intro":"In nature, getting fooled can be a matter of life and death — and lots of animals have learned to fool others. Let's look at the tricksters.","clues":[{"text":"A stick insect looks exactly like a twig — predators' eyes are 'trained' on real twigs, so the insect slips by.","image_url":null,"habitat":"jungle"},{"text":"Some butterflies have giant eyespots on their wings that fool birds into thinking they face a bigger animal.","image_url":null,"habitat":"jungle"},{"text":"A harmless milk snake copies the bright stripes of a venomous coral snake, so predators avoid it by mistake.","image_url":null,"habitat":"desert"},{"text":"An octopus changes colour and texture to vanish against coral — the ultimate 'fake'.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"An AI is only as fair as its examples. If it only ever sees RED apples, it secretly learns 'apple = red' — so a green apple fools it, just like a predator fooled by camouflage. This is called BIAS, and it comes from one-sided data. Fix the data (add the missing examples) and you fix the AI.","reveal_hint":"If you only showed the machine one colour of apple, what has it REALLY learned to detect?"},
  {"step":"skill","instructions":"Learn how one-sided data creates bias. UNPLUGGED: build a card classifier trained only on red apples, then test it on a green apple and a red ball — watch it fail. PLUGGED (optional): in the Machine Trainer, train an 'apple' class using only red apples, then test green apples; then RETRAIN with varied apples and compare.","skill_refs":[],"hints":["If you only show red apples, the machine may secretly learn 'apple = red'.", "Predict which test picture will fool it before you try."]},
  {"step":"sketch","prompt":"Plan a deliberately biased training set — and predict how it will fail.","guidance":"Write down the one-sided examples you'll use, then predict exactly which test items will fool the AI and why. Then plan the BALANCED set that would fix it."},
  {"step":"build_and_test","instructions":"UNPLUGGED: run your test cards through the biased classifier and record the mistakes; then add the missing varied examples and test again. PLUGGED (optional): compare the Machine Trainer's accuracy before and after balancing the data.","test_criteria":["Measure accuracy with the BIASED data (expect it to be low on the surprising cases).","Fix the data, retrain/re-score, and measure accuracy AGAIN.","Explain in one sentence what bias your data had and how balancing it helped."],"hints":["Measure accuracy on the surprising cases before AND after adding variety.", "Ask: what kind of example was missing from the training pile?"]},
  {"step":"celebrate_and_share","celebration_text":"You found the AI's blind spot AND fixed it — that's exactly the job of people who build fair AI in the real world.","share_prompt":"Share the bias you discovered and your before/after accuracy once you balanced the data."}
]"#,
            // tools JSON
            r#"[
  {"kind":"five_whys","age_mode":"young"},
  {"kind":"five_whys","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Train a classifier on only one kind of example, see it get fooled, then add the missing examples to fix it."},
  {"age_tier":"10-12","title_override":null,"summary":"Measure accuracy before and after balancing the data, and name the bias you created."},
  {"age_tier":"12-18","title_override":"Bias & Fairness in Machine Learning","summary":"Design a biased dataset, quantify the accuracy gap on under-represented cases, and show how balancing the data closes it."}
]"#,
            false, // free — class-joined kids have no family subscription
        ),
        (
            "bring-it-to-life",
            "Bring It to Life!",
            1,
            7,
            // steps JSON
            r#"[
  {"step":"brief","title":"The Doodle That Wouldn't Move","story":"Meet Doodle, a little sketch who dreams of dancing — but stuck on the page, it can't move a muscle! Here's the secret grown-up movies don't tell you: cartoons and films don't really move either. They're just LOTS of still pictures, shown so fast that your brain blends them into motion. Your mission: bring something to life — a bouncing ball, a walking blob, a blooming flower — one frame at a time.","image_url":null},
  {"step":"your_idea","prompt":"How would YOU make a drawing look like it's moving? Do you already have an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Your eyes and brain are amazing motion machines. Let's see how living things make — and see — movement.","clues":[{"text":"When a horse gallops, all four hooves leave the ground at once — too fast for anyone to see, until people lined up photos frame by frame and finally caught it.","image_url":null,"habitat":"desert"},{"text":"Your eyes hold onto each picture for a split second after it's gone. Flash pictures fast enough and your brain smooths them into one moving scene — that's why films feel alive.","image_url":null,"habitat":"jungle"},{"text":"A flock of starlings swirls like one giant creature. Each bird shifts a heartbeat after its neighbour, and all those tiny changes add up to a flowing, rippling shape.","image_url":null,"habitat":"sky"},{"text":"A cuttlefish sends bands of colour rippling across its skin by switching tiny dots on and off in sequence — a living animation played right on its body.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"Animation is an ILLUSION. It's just a row of still pictures — called frames — each changed a tiny bit, played fast. The more frames you use, and the SMALLER the change between them, the smoother the motion looks. Big jumps look jerky; tiny steps look alive. That is the whole trick, and it has a name: frames per second.","reveal_hint":"Think about a flipbook: what happens if you draw only 3 pages for a jump versus 30 pages?"},
  {"step":"skill","instructions":"Learn the animator's toolkit. A KEYFRAME is a big pose (ball at the top, ball on the ground). IN-BETWEENS are the small steps that connect the keyframes. TIMING is how fast you flip through them. UNPLUGGED: make a flipbook — draw a bouncing ball on the corner of 10-15 sticky notes, moving it a little on each page, then flip. PLUGGED (optional): open the Animation Studio below, add frames (draw one or snap a photo), and press play to watch them come alive.","skill_refs":[],"hints":["Start with just two keyframes — where your thing STARTS and where it ENDS. Then fill in the middle.","Move your object only a LITTLE between frames. Small changes make smooth motion."]},
  {"step":"sketch","prompt":"Pick ONE simple thing to animate, then plan your frames before you make them.","guidance":"Storyboard it: What is moving? Where does it start and where does it end? Roughly how many frames will you need — and where will the motion need extra frames to look smooth? A simple move with enough frames beats a fancy idea with too few."},
  {"step":"build_and_test","instructions":"UNPLUGGED: flip your flipbook and watch it move. PLUGGED (optional): in the Animation Studio, add your frames in order and press play. Either way, watch it back and fix the jerky parts.","test_criteria":["Play it back: does it read as smooth motion, or does it jump? Count how many frames you used.","Find the jerkiest moment and add one or two MORE frames right there, with smaller changes. Play again — is it smoother?","Try changing the speed (frames per second). Which speed makes your motion look best?"],"hints":["If a move looks jumpy, you usually need more frames in that spot — not faster playback.","Keep the paper or camera still so that only your object moves between frames."]},
  {"step":"celebrate_and_share","celebration_text":"You just brought something to life — you're an animator now! You discovered that motion is really just still pictures plus tiny changes, played fast.","share_prompt":"Share your animation (or a photo of your flipbook) AND tell us: how many frames did it take, and where did you have to add more to make it smooth?"}
]"#,
            // tools JSON
            r#"[
  {"kind":"mind_map","age_mode":"young"},
  {"kind":"scamper","age_mode":"older"}
]"#,
            // age_tier_variants JSON
            r#"[
  {"age_tier":"8-10","title_override":null,"summary":"Animate one simple thing (a bouncing ball or a growing flower). Focus on making lots of frames with tiny changes, then flipping through them."},
  {"age_tier":"10-12","title_override":null,"summary":"Plan keyframes and in-betweens, count your frames, and fix jerky spots by adding frames. Try two playback speeds and pick the best."},
  {"age_tier":"12-18","title_override":"Frame-by-Frame Animation","summary":"Storyboard a short action, reason about frames-per-second and easing (slow-in / slow-out), and compare how frame count changes the feel of the motion."}
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
