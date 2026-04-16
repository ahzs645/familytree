/**
 * Title case string formatter.
 * Replaces webpack module 377.
 *
 * Can be replaced with: npm install title-case
 * import { titleCase } from 'title-case';
 */

const SMALL_WORDS =
  /^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|vs?\.?|via)$/i;

function capitalizeWords(str) {
  return str
    .toString()
    .trim()
    .replace(/[A-Za-z0-9\u00C0-\u00FF]+[^\s-]*/g, function (word, index, fullStr) {
      if (
        index > 0 &&
        index + word.length !== fullStr.length &&
        word.search(SMALL_WORDS) > -1 &&
        fullStr.charAt(index - 2) !== ':' &&
        (fullStr.charAt(index + word.length) !== '-' || fullStr.charAt(index - 1) === '-') &&
        fullStr.charAt(index - 1).search(/[^\s-]/) < 0
      ) {
        return word.toLowerCase();
      }
      if (word.substr(1).search(/[A-Z]|\../) > -1) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.substr(1);
    });
}

function redactEmails(str) {
  return str.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '***@$2'
  );
}

export default function titleCase(str = '', capitalize = true, redact = true) {
  let result = str || '';
  if (capitalize) result = capitalizeWords(result);
  if (redact) result = redactEmails(result);
  return result;
}
