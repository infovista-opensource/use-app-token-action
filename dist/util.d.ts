export declare function getAppSlugName(): string;
export declare function getAppTokenName(): string;
export declare function getOrganization(): string | undefined;
export declare function getAppInfo(): Promise<{
    token: any;
    slug: string;
}>;
export declare function createSecret(token: string, secretName: string, secretValue: string): Promise<void>;
export declare function deleteSecret(token: string, secretName: string): Promise<void>;
export declare function deleteToken(token: string): Promise<void>;
