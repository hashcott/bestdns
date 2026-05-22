import pkg from "../package.json" with { type: "json" };

/** Package name. */
export const NAME: string = pkg.name;

/** Current version — kept in sync by semantic-release at publish time. */
export const VERSION: string = pkg.version;

/** One-line package description. */
export const DESCRIPTION: string = pkg.description;
