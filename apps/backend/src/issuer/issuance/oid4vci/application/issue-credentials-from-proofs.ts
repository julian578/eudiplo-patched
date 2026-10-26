import type { Jwk } from "@openid4vc/oauth2";
import { calculateJwkThumbprint } from "jose";
import type { SessionData } from "../../../../session/domain/session-data.js";
import type { TrustListRef } from "../../../../trust/types.js";
import { InvalidCredentialProof } from "../domain/credential-proof-errors.js";
import {
    assertKeyAttestationRequirements,
    type KeyAttestationRequirements,
} from "../domain/key-attestation-requirements.js";
import type {
    CredentialProofVerifier,
    IssuanceProofType,
} from "../ports/credential-proof-verifier.js";
import type { IssueCredentialsForKeys } from "./issue-credentials-for-keys.js";

export class IssueCredentialsFromProofs {
    constructor(
        private readonly verifier: CredentialProofVerifier,
        private readonly issue: Pick<IssueCredentialsForKeys, "execute">,
    ) {}
    async execute(command: {
        proofs: string[];
        proofType: IssuanceProofType;
        session: SessionData;
        credentialConfigurationId: string;
        claims?: Record<string, unknown>;
        issuanceSetId: string;
        batchSize?: number;
        trustLists: TrustListRef[];
        /** Key attestation requirements of the credential configuration. */
        keyAttestationsRequired?: KeyAttestationRequirements;
        onIssued: (credentialSize: number) => void;
    }): Promise<{ credential: string }[]> {
        const verifier = await this.verifier.prepare(
            command.session.tenantId,
            command.trustLists,
        );
        // Verify every proof before issuing, so an invalid proof in a batch
        // does not leave credentials issued for the proofs before it.
        const holderKeysPerProof: Jwk[][] = [];
        for (const proof of command.proofs) {
            const verified = await verifier.verify(proof, command.proofType);
            const holderKeys = verified.holderKeys;
            const expectedThumbprint = command.session.credentialPayload?.expectedKeyThumbprint;
            if (expectedThumbprint) {
                if (!Array.isArray(holderKeys) || holderKeys.length !== 1 || command.proofs.length !== 1) {
                    throw new InvalidCredentialProof(
                        "A key-bound offer requires exactly one proof and one holder key",
                    );
                }
                const actualThumbprint = await calculateJwkThumbprint(
                    holderKeys[0] as Parameters<typeof calculateJwkThumbprint>[0],
                    "sha256",
                );
                if (actualThumbprint !== expectedThumbprint) {
                    throw new InvalidCredentialProof(
                        "Credential proof key does not match the thumbprint required by this offer",
                    );
                }
            }
            if (command.proofType === "attestation") {
                if (!Array.isArray(holderKeys) || holderKeys.length === 0)
                    throw new InvalidCredentialProof(
                        "Attestation proof does not contain any attested keys",
                    );
                if (holderKeys.length > Math.max(command.batchSize ?? 1, 1))
                    throw new InvalidCredentialProof(
                        "Attestation proof contains more attested keys than the supported batch size",
                    );
            }
            assertKeyAttestationRequirements(
                command.keyAttestationsRequired,
                verified,
            );
            holderKeysPerProof.push(holderKeys);
        }
        const result: { credential: string }[] = [];
        for (const holderKeys of holderKeysPerProof) {
            const credentials = await this.issue.execute({
                credentialConfigurationId: command.credentialConfigurationId,
                holderKeys,
                session: command.session,
                claims: command.claims,
                issuanceSetId: command.issuanceSetId,
            });
            for (const credential of credentials) {
                result.push({ credential });
                command.onIssued(credential.length);
            }
        }
        return result;
    }
}
