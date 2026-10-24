import type {
    Notification,
    SessionData,
} from "../../../../session/domain/session-data.js";
import type { WebhookConfiguration } from "../../../../webhook/domain/webhook-configuration.js";

export const CREDENTIAL_NOTIFICATION_PUBLISHER = Symbol(
    "CREDENTIAL_NOTIFICATION_PUBLISHER",
);

export interface CredentialNotificationPublisher {
    publish(
        configuration: WebhookConfiguration,
        session: SessionData,
        notification: Notification,
    ): Promise<void>;

    /** Reports the public holder key from an issued credential to the offer webhook. */
    publishCredentialIssued?(
        configuration: WebhookConfiguration,
        session: SessionData,
        credentialConfigurationId: string,
        cnfJwk: Record<string, unknown>,
    ): Promise<void>;
}
