/*
 * What this file does:
 * Wires concrete repositories to services so route handlers stay thin and dependency boundaries stay explicit.
 * What calls it:
 * route handlers under src/app/api/platform.
 * What it calls:
 * Repository constructors in src/repositories/*.ts and service constructors in src/services/*.ts.
 * One thing a junior engineer would likely get wrong:
 * Instantiating repositories inside every route function, which makes testing and dependency swapping painful.
 */

import { PrismaAuditLogRepository } from "@/repositories/audit-log-repository";
import { PrismaCustomerProfileRepository } from "@/repositories/customer-profile-repository";
import { PrismaUsageMetricRepository } from "@/repositories/usage-metric-repository";
import { PrismaVersionCatalogRepository } from "@/repositories/version-catalog-repository";
import { ApiVersionService } from "@/services/api-version-service";
import { CustomerProfileService } from "@/services/customer-profile-service";

const auditLogRepository = new PrismaAuditLogRepository();
const customerProfileRepository = new PrismaCustomerProfileRepository();
const usageMetricRepository = new PrismaUsageMetricRepository();
const versionCatalogRepository = new PrismaVersionCatalogRepository();

export const services = {
  customerProfiles: new CustomerProfileService(customerProfileRepository, auditLogRepository),
  apiVersions: new ApiVersionService(
    versionCatalogRepository,
    usageMetricRepository,
    auditLogRepository
  )
};
