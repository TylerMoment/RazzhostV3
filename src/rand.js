/*
@license generateRandomString:

MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Taken from:
https://github.com/sindresorhus/crypto-random-string/blob/a93cea08c5a1edfce2e2888651987686d03a57ba/index.js#L12

Changes:
- Use crypto.getRandomValues instead of crypto.randomBytes
*/
export const generateRandomString = (length, characters) => {
    // Generating entropy is faster than complex math operations, so we use the simplest way
    const characterCount = characters.length;
    const maxValidSelector =
        Math.floor(0x10000 / characterCount) * characterCount - 1; // Using values above this will ruin distribution when using modular division
    const entropyLength = 2 * Math.ceil(1.1 * length); // Generating a bit more than required so chances we need more than one pass will be really low
    let string = "";
    let stringLength = 0;

    while (stringLength < length) {
        // In case we had many bad values, which may happen for character sets of size above 0x8000 but close to it
        const entropy = crypto.getRandomValues(new Uint16Array(entropyLength));
        let entropyPosition = 0;

        while (entropyPosition < entropyLength && stringLength < length) {
            const entropyValue = entropy[entropyPosition];
            entropyPosition += 2;
            if (entropyValue > maxValidSelector) {
                // Skip values which will ruin distribution when using modular division
                continue;
            }

            string += characters[entropyValue % characterCount];
            stringLength++;
        }
    }

    return string;
};
