// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`.
"use client";

import * as React from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccount } from "./delete-account-action";

/**
 * Typed verbatim to arm the delete button. Uppercase and matched exactly, so it
 * cannot be satisfied by an accidental keystroke.
 */
const CONFIRMATION_PHRASE = "DELETE";

/**
 * The Danger Zone's control: a two-step, type-to-confirm account deletion.
 *
 * Confirmation is inline rather than a modal on purpose. This project has no
 * `dialog`/`alert-dialog` primitive in `components/ui/`, and adding one to ask
 * a single question would introduce a primitive with one consumer while
 * changing the settings page's visual language. Expanding in place keeps both
 * as they are, and a phrase the user has to type is a stronger gate than a
 * button they can click twice quickly.
 *
 * Note this component never names the account to delete. The Server Action
 * takes no arguments and the SQL function derives the user from `auth.uid()`,
 * so there is deliberately no user id anywhere in this file to tamper with.
 */
export function DeleteAccountCard() {
  const [confirming, setConfirming] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Opening the confirmation moves focus to the thing that has to be filled in,
  // so a keyboard user is not left tabbing forward to find it.
  React.useEffect(() => {
    if (confirming) inputRef.current?.focus();
  }, [confirming]);

  const armed = phrase.trim() === CONFIRMATION_PHRASE;

  function handleCancel() {
    setConfirming(false);
    setPhrase("");
    setError(null);
  }

  function handleDelete() {
    if (!armed) return;

    setError(null);

    startTransition(async () => {
      // Resolves only on failure — success redirects from the server, which is
      // why there is no success branch here.
      const result = await deleteAccount();
      if (result?.error) setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-4">
        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={() => setConfirming(true)}
          className="h-11 w-full px-6 sm:w-auto"
        >
          Delete Account
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AuthAlert>
        This permanently deletes your Nexona account and everything in it — your
        resume analyses, ATS audits, cover letters, career insights and
        interview preparation. This cannot be undone, and we cannot recover any
        of it for you afterwards.
      </AuthAlert>

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-account-confirmation">
          Type {CONFIRMATION_PHRASE} to confirm
        </Label>

        <Input
          ref={inputRef}
          id="delete-account-confirmation"
          name="delete-account-confirmation"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          disabled={pending}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="delete-account-confirmation-hint"
          className="h-11 sm:max-w-xs"
        />

        <p
          id="delete-account-confirmation-hint"
          className="text-muted-foreground text-xs"
        >
          Enter it exactly, in capitals.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={handleDelete}
          disabled={!armed || pending}
          className="h-11 w-full px-6 sm:w-auto"
        >
          {pending ? "Deleting…" : "Permanently delete account"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleCancel}
          disabled={pending}
          className="h-11 w-full px-6 sm:w-auto"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
