/**
 * Type augmentation for enquirer.
 *
 * The shipped @types only expose the `Enquirer` class and the `prompt` helper, but the
 * library actually exports a number of static prompt classes (`Select`, `Confirm`,
 * `Input`, `Password`, `MultiSelect`, `AutoComplete`, etc.) at runtime. We declare
 * them here so consumers can `import { Select } from 'enquirer'` or
 * `Enquirer.Select` without TypeScript errors.
 */
declare module 'enquirer' {
  interface PromptCtorOptions {
    name?: string;
    message?: string;
    initial?: unknown;
    choices?: unknown;
    [key: string]: unknown;
  }

  // The runtime can resolve to a string, boolean, or array depending on prompt type.
  // Default to `any` so call sites can assign without explicit generics, matching
  // the original untyped `require('enquirer')` behavior.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class PromptBase {
    constructor(options?: PromptCtorOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run<T = any>(): Promise<T>;
  }

  // Prompt classes available as both named exports and static properties on Enquirer.
  export class Select extends PromptBase {}
  export class AutoComplete extends PromptBase {}
  export class MultiSelect extends PromptBase {}
  export class Input extends PromptBase {}
  export class Password extends PromptBase {}
  export class Confirm extends PromptBase {}
  export class Form extends PromptBase {}
  export class List extends PromptBase {}
  export class NumberPrompt extends PromptBase {}
  export class Snippet extends PromptBase {}
  export class Survey extends PromptBase {}
  export class Toggle extends PromptBase {}
  export class Quiz extends PromptBase {}
  export class Scale extends PromptBase {}
  export class Sort extends PromptBase {}
  export class Editable extends PromptBase {}
}
