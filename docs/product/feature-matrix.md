# Feature Matrix

| Feature | Contract/File | Outcome |
| --- | --- | --- |
| Mint `444` assets with fee/payment rules | `minting.helios` (`MINT`) | Transaction only approves when asset allow-list, pricing, and payout conditions are met. |
| Mint `100` reference tokens | `minting.helios` (`MINT`) | Reference token mint requires correct UTxO consumption and owner signature. |
| Burn `100` reference tokens | `minting.helios` (`BURN`) | Burn path only allows negative mint of `100` tokens with remaining positive supply guard. |
| Update reference-token output checks | `editing.helios` (`UPDATE_REFERENCE_TOKEN`) | Spending validation ensures output destination and owner signature conditions. |
| Contract scenario validation | `tests/tests.ts`, `tests/contractTester.ts`, `tests/fixtures.ts` | Operators can run scripted contract approve/deny suites locally. |
