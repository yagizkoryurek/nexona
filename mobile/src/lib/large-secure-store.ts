import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';

/**
 * Session storage for the Supabase client, following Supabase's own documented
 * Expo pattern rather than an invented one.
 *
 * Expo's SecureStore cannot hold values larger than 2048 bytes, and a Supabase
 * session (access JWT + refresh token + user object) routinely exceeds that.
 * So the split is: a freshly generated AES-256 key goes into SecureStore
 * (hardware-backed — iOS Keychain / Android Keystore), and the *encrypted*
 * session goes into AsyncStorage, which has no size limit but is plaintext on
 * disk. Neither half is useful alone.
 *
 * The cryptography follows the upstream implementation exactly. Supabase
 * explicitly warns that optimising or restructuring it can introduce subtle
 * security vulnerabilities, so changes there should be weighed against that
 * rather than treated as ordinary refactoring. The one deliberate deviation is
 * the text encoding described on `toBytes` below, which fixes a data-corruption
 * bug without touching the cipher, the key size, or the key's storage.
 *
 * Satisfies `SupportedStorage` from @supabase/auth-js — getItem / setItem /
 * removeItem, all promisified.
 */

/**
 * String -> bytes, via percent-encoding rather than `aesjs.utils.utf8.toBytes`.
 *
 * aes-js's own UTF-8 helpers silently corrupt 4-byte sequences — astral-plane
 * characters, which in practice means emoji. Verified against the installed
 * version: 'Yağız' and '日本語' survive a round-trip, '🎉' comes back as 'ߎ退'.
 * That matters here because a stored session embeds `user_metadata.full_name`,
 * which is whatever the user typed at sign-up, so an emoji in a display name
 * would corrupt that user's session and read back as garbage.
 *
 * `encodeURIComponent` is an ECMAScript built-in (so guaranteed present in
 * Hermes, unlike `TextEncoder`, which Expo does not install as a global), it
 * handles surrogate pairs correctly, and it emits pure ASCII — which aes-js's
 * helpers do handle correctly. The percent-escaping inflates non-ASCII text,
 * which is irrelevant: the ciphertext lands in AsyncStorage, which has no size
 * limit, and a session is almost entirely base64url JWT anyway.
 *
 * This changes only how text becomes bytes. AES-256-CTR still operates on the
 * same byte array, so the security properties are untouched.
 */
function toBytes(value: string): Uint8Array {
  return aesjs.utils.utf8.toBytes(encodeURIComponent(value));
}

/** Inverse of `toBytes`. */
function fromBytes(bytes: Uint8Array): string {
  return decodeURIComponent(aesjs.utils.utf8.fromBytes(bytes));
}

export class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    // A new key per write. `crypto.getRandomValues` is provided by the
    // react-native-get-random-values import above — React Native's JS engine
    // has no Web Crypto of its own.
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(toBytes(value));

    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey)
    );

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return encryptionKeyHex;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }

    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value);

    await AsyncStorage.setItem(key, encrypted);
  }

  /** Both halves go, or the leftover would be undecryptable dead weight. */
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
