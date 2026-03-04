use aiken/merkle_patricia_forestry as mpf
use cardano/address.{Address}
use cardano/transaction.{TransactionId}

pub type MintRedeemer {
  Mint { asset_proofs: List<AssetProof> }
  Burn
}

pub type EditRedeemer {
  UpdateReferenceToken { asset: ByteArray }
  Invalid
}

pub type MintConfig {
  fee_address: Address,
  fee_schedule: List<List<Int>>,
}

pub type Utxo {
  hash: TransactionId,
  index: Int,
}

pub type DiscountRule {
  policy_prefix: ByteArray,
  min_quantity: Int,
  discounted_price: Int,
}

pub type MintAsset {
  name: ByteArray,
  utxo: Utxo,
  price: Int,
  valid_until: Int,
  discounts: List<DiscountRule>,
}

pub type AssetProof {
  name: ByteArray,
  proof: mpf.Proof,
}

pub type MintSettings {
  payment_address: Address,
  reference_token_address: Address,
  mint_governor: ByteArray,
  editing_governor: ByteArray,
  assets: List<MintAsset>,
  assets_root_hash: ByteArray,
  details: Option<Data>,
}

pub type MintCost {
  payment: Int,
  fee: Int,
}
