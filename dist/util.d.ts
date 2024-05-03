export declare function getAppSlugName(): string;
export declare function getAppTokenName(): string;
export declare function getOrganization(): string | undefined;
export declare function getAppInfo(): Promise<{
    token: any;
    slug: any;
}>;
export declare function deleteToken(token: string): Promise<void>;
