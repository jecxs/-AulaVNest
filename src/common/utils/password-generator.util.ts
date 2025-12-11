// src/common/utils/password-generator.util.ts
import * as crypto from 'crypto';

export class PasswordGenerator {
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly NUMBERS = '0123456789';
  private static readonly SYMBOLS = '!@#$%&*';

  /**
   * Genera una contraseña aleatoria segura
   * @param length - Longitud de la contraseña (por defecto 12)
   * @param includeSymbols - Si incluir símbolos especiales (por defecto true)
   * @returns Contraseña generada
   */
  static generate(length: number = 12, includeSymbols: boolean = true): string {
    if (length < 8) {
      throw new Error('Password length must be at least 8 characters');
    }

    let charset = this.LOWERCASE + this.UPPERCASE + this.NUMBERS;
    if (includeSymbols) {
      charset += this.SYMBOLS;
    }

    let password = '';

    // Asegurar que tenga al menos un carácter de cada tipo
    password += this.getRandomChar(this.LOWERCASE);
    password += this.getRandomChar(this.UPPERCASE);
    password += this.getRandomChar(this.NUMBERS);
    if (includeSymbols) {
      password += this.getRandomChar(this.SYMBOLS);
    }

    // Completar el resto de la contraseña
    const remainingLength = length - password.length;
    for (let i = 0; i < remainingLength; i++) {
      password += this.getRandomChar(charset);
    }

    // Mezclar los caracteres para que no sean predecibles
    return this.shuffleString(password);
  }

  private static getRandomChar(charset: string): string {
    const randomIndex = crypto.randomInt(0, charset.length);
    return charset[randomIndex];
  }

  private static shuffleString(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  }
}