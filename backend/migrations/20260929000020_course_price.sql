-- Special expert courses sold one by one, outside the monthly plans.
-- NULL = included in Plus / Family like every other course; a number = this
-- course has its own price, in Toman, shown on its card and page.
--
-- Append-only + reversible. To reverse:
--   ALTER TABLE courses DROP COLUMN price_toman;

ALTER TABLE courses
    ADD COLUMN price_toman INTEGER CHECK (price_toman IS NULL OR price_toman > 0);
