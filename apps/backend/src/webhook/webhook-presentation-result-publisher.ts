import { Injectable } from "@nestjs/common";
import { SessionStatus } from "../session/domain/session-state.js";
import type {
    PresentationResult,
    PresentationResultPublication,
    PresentationResultPublisher,
} from "./ports/presentation-result-publisher.js";
import { WebhookService } from "./webhook.service.js";

@Injectable()
export class WebhookPresentationResultPublisher
    implements PresentationResultPublisher
{
    constructor(private readonly webhooks: WebhookService) {}

    async publish(
        values: PresentationResultPublication,
    ): Promise<PresentationResult> {
        const webhook =
            values.status === SessionStatus.Completed
                ? {
                      ...values.webhook,
                      includeRawTokensFor: (
                          values.credentials as
                              | Array<{ id: string }>
                              | undefined
                      )?.map((credential) => credential.id),
                  }
                : values.webhook;

        const response = await this.webhooks.sendWebhook({
            webhook,
            session: values.session,
            result: {
                status: values.status,
                outcome: values.outcome,
                ...(values.status === SessionStatus.Completed &&
                values.responseCode
                    ? { response_code: values.responseCode }
                    : {}),
            },
            // Failure results never carry credentials or raw tokens.
            ...(values.status === SessionStatus.Completed
                ? {
                      credentials: values.credentials as any[] | undefined,
                      rawPresentationPayload: values.rawPresentationPayload as
                          | Record<string, unknown>
                          | undefined,
                  }
                : {}),
        });
        return response?.redirectUri
            ? { redirectUri: response.redirectUri }
            : {};
    }
}
