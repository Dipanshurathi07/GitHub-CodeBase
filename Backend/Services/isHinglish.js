function isHinglish(text) {
    return /\b(hinglish|hindi|kyun|kyu|kya|kaise|kese|mujhe|batao|samjhao|hai|kar|kr|mera|meri|isse|iska|chahiye|dena)\b/i.test(text);
}

module.exports = isHinglish;
