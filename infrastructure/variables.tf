variable "product" {}

variable "component" {}

variable "location" {
  default = "UK South"
}

variable "env" {}

variable "subscription" {}

variable "common_tags" {
  type = map(string)
}

variable "aks_subscription_id" {}

variable "jenkins_AAD_objectId" {
  description = "(Required) The Azure AD object ID of a user, service principal or security group in the Azure Active Directory tenant for the vault. The object ID must be unique for the list of access policies."
}

variable "redis_family" {
  default     = "C"
  description = "The SKU family/pricing group to use. Valid values are `C` (for Basic/Standard SKU family) and `P` (for Premium). Use P for higher availability, but beware it costs a lot more."
}

variable "redis_sku_name" {
  default     = "Basic"
  description = "The SKU of Redis to use. Possible values are `Basic`, `Standard` and `Premium`."
}

variable "redis_capacity" {
  default     = "1"
  description = "The size of the Redis cache to deploy. Valid values are 1, 2, 3, 4, 5"
}

variable "private_dns_subscription_id" {
  default     = "fb084706-583f-4c9a-bdab-949aac66ba5c"
  type        = string
  description = "Subscription ID containing the privatelink.redis.azure.net private DNS zone."
}

variable "managed_redis_sku" {
  type        = string
  default     = "Balanced_B0"
  description = "Managed Redis SKU. Override per environment in <env>.tfvars."
}

variable "managed_redis_persistence_rdb_frequency" {
  type        = string
  default     = null
  description = "RDB backup frequency for Managed Redis (1h, 6h, 12h). null means no persistence."
}
