# cip-68-444-minting canonical contract

On-chain program (Aiken) that mints and edits CIP-68 444 (rich-fungible) assets through a frozen proxy and swappable governors.

1. The policy id and editing script address are frozen: `validators/minting.ak` and `validators/editing.ak` hold no logic; logic moves only by swapping the `mint_governor` and `editing_governor` hashes in settings via a zero-ada withdrawal with an exact hash match.
2. Only allow-listed assets mint: each carries an MPF proof against `assets_root_hash`; price, discount, required UTxO and validity come from the settings token.
3. Payments and fees go to `payment_address` as priced.
4. Reference tokens stay at `reference_token_address` and only the owner can edit them (`editing_observer.ak`).
