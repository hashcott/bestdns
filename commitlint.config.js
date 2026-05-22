/**
 * Conventional Commits rules — consumed by commitlint via the Husky `commit-msg` hook.
 * semantic-release reads the same commit history to decide the next version bump:
 *   fix:    -> patch    feat:   -> minor    feat!: / BREAKING CHANGE -> major
 */
export default {
  extends: ["@commitlint/config-conventional"],
};
