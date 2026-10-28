# Finance dashboard

Mode: Operate. User-directed redesign, based on the owner's 28 October 2026 brief and screenshots.

Product truth: Finance is a private section of Task Set's existing React/Vite app and authenticated Worker. Bank source facts are retained separately from user bookkeeping. Accounts, transaction review, user categories, analytics, saved reports and backup remain available. NZD totals and Auckland date boundaries retain their existing meanings. No production data or setup is changed by design verification.

Direction: code-led, Stripe-inspired operational dashboard. Cool neutral canvas, white work surfaces, indigo actions, restrained typography, dense aligned rows and explicit status. Reuse semantic tokens, Lucide icons and existing component homes. Other Task Set sections retain their existing notes-app design.

First viewport: compact workspace title; a persistent 196 px Finance section rail above 1150 px (horizontal strip at 1150 px and below, section picker at 600 px and below); a named current page with relevant actions and dates; an immediately useful transaction register or category table. Controls, totals and pagination form tight horizontal groups. Mobile wraps controls without page overflow.

Signature interaction: clicking a category opens every matching transaction across retained history, with a visible removable category filter. Separate edit/delete actions never compete with that drill-down.

Primary journeys: select/review/bulk categorise hundreds of transactions; browse/edit/delete categories in a paginated table with all-history assignment counts, confirmation and a replacement category while retaining bank facts; create and view a saved Excel workbook in the browser, switch sheets and page through every row (50 data rows per page, all columns); inspect bank health in Activity (five of the latest twenty sync runs per page, five of the latest two hundred notifications per page). Empty, loading, failure and narrow-screen states must stay actionable.
