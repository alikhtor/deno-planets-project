// Ported from Go:
// https://github.com/golang/go/blob/go1.12.5/src/encoding/csv/
// Copyright 2011 The Go Authors. All rights reserved. BSD license.
// https://github.com/golang/go/blob/master/LICENSE
// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.
import { BufReader } from "../io/bufio.ts";
import { TextProtoReader } from "../textproto/mod.ts";
import { StringReader } from "../io/readers.ts";
import { assert } from "../_util/assert.ts";
const INVALID_RUNE = ["\r", "\n", '"'];
export const ERR_BARE_QUOTE = 'bare " in non-quoted-field';
export const ERR_QUOTE = 'extraneous or missing " in quoted-field';
export const ERR_INVALID_DELIM = "Invalid Delimiter";
export const ERR_FIELD_COUNT = "wrong number of fields";
export class ParseError extends Error {
    constructor(start, line, message) {
        super(message);
        this.StartLine = start;
        this.Line = line;
    }
}
function chkOptions(opt) {
    if (!opt.comma) {
        opt.comma = ",";
    }
    if (!opt.trimLeadingSpace) {
        opt.trimLeadingSpace = false;
    }
    if (INVALID_RUNE.includes(opt.comma) ||
        (typeof opt.comment === "string" && INVALID_RUNE.includes(opt.comment)) ||
        opt.comma === opt.comment) {
        throw new Error(ERR_INVALID_DELIM);
    }
}
async function readRecord(Startline, reader, opt = { comma: ",", trimLeadingSpace: false }) {
    const tp = new TextProtoReader(reader);
    const lineIndex = Startline;
    let line = await readLine(tp);
    if (line === null)
        return null;
    if (line.length === 0) {
        return [];
    }
    // line starting with comment character is ignored
    if (opt.comment && line[0] === opt.comment) {
        return [];
    }
    assert(opt.comma != null);
    let quoteError = null;
    const quote = '"';
    const quoteLen = quote.length;
    const commaLen = opt.comma.length;
    let recordBuffer = "";
    const fieldIndexes = [];
    parseField: for (;;) {
        if (opt.trimLeadingSpace) {
            line = line.trimLeft();
        }
        if (line.length === 0 || !line.startsWith(quote)) {
            // Non-quoted string field
            const i = line.indexOf(opt.comma);
            let field = line;
            if (i >= 0) {
                field = field.substring(0, i);
            }
            // Check to make sure a quote does not appear in field.
            if (!opt.lazyQuotes) {
                const j = field.indexOf(quote);
                if (j >= 0) {
                    quoteError = ERR_BARE_QUOTE;
                    break parseField;
                }
            }
            recordBuffer += field;
            fieldIndexes.push(recordBuffer.length);
            if (i >= 0) {
                line = line.substring(i + commaLen);
                continue parseField;
            }
            break parseField;
        }
        else {
            // Quoted string field
            line = line.substring(quoteLen);
            for (;;) {
                const i = line.indexOf(quote);
                if (i >= 0) {
                    // Hit next quote.
                    recordBuffer += line.substring(0, i);
                    line = line.substring(i + quoteLen);
                    if (line.startsWith(quote)) {
                        // `""` sequence (append quote).
                        recordBuffer += quote;
                        line = line.substring(quoteLen);
                    }
                    else if (line.startsWith(opt.comma)) {
                        // `","` sequence (end of field).
                        line = line.substring(commaLen);
                        fieldIndexes.push(recordBuffer.length);
                        continue parseField;
                    }
                    else if (0 === line.length) {
                        // `"\n` sequence (end of line).
                        fieldIndexes.push(recordBuffer.length);
                        break parseField;
                    }
                    else if (opt.lazyQuotes) {
                        // `"` sequence (bare quote).
                        recordBuffer += quote;
                    }
                    else {
                        // `"*` sequence (invalid non-escaped quote).
                        quoteError = ERR_QUOTE;
                        break parseField;
                    }
                }
                else if (line.length > 0 || !(await isEOF(tp))) {
                    // Hit end of line (copy all data so far).
                    recordBuffer += line;
                    const r = await readLine(tp);
                    if (r === null) {
                        if (!opt.lazyQuotes) {
                            quoteError = ERR_QUOTE;
                            break parseField;
                        }
                        fieldIndexes.push(recordBuffer.length);
                        break parseField;
                    }
                    recordBuffer += "\n"; // preserve line feed (This is because TextProtoReader removes it.)
                    line = r;
                }
                else {
                    // Abrupt end of file (EOF on error).
                    if (!opt.lazyQuotes) {
                        quoteError = ERR_QUOTE;
                        break parseField;
                    }
                    fieldIndexes.push(recordBuffer.length);
                    break parseField;
                }
            }
        }
    }
    if (quoteError) {
        throw new ParseError(Startline, lineIndex, quoteError);
    }
    const result = [];
    let preIdx = 0;
    for (const i of fieldIndexes) {
        result.push(recordBuffer.slice(preIdx, i));
        preIdx = i;
    }
    return result;
}
async function isEOF(tp) {
    return (await tp.r.peek(0)) === null;
}
async function readLine(tp) {
    let line;
    const r = await tp.readLine();
    if (r === null)
        return null;
    line = r;
    // For backwards compatibility, drop trailing \r before EOF.
    if ((await isEOF(tp)) && line.length > 0 && line[line.length - 1] === "\r") {
        line = line.substring(0, line.length - 1);
    }
    // Normalize \r\n to \n on all input lines.
    if (line.length >= 2 &&
        line[line.length - 2] === "\r" &&
        line[line.length - 1] === "\n") {
        line = line.substring(0, line.length - 2);
        line = line + "\n";
    }
    return line;
}
/**
 * Parse the CSV from the `reader` with the options provided and return `string[][]`.
 *
 * @param reader provides the CSV data to parse
 * @param opt controls the parsing behavior
 */
export async function readMatrix(reader, opt = {
    comma: ",",
    trimLeadingSpace: false,
    lazyQuotes: false,
}) {
    const result = [];
    let _nbFields;
    let lineResult;
    let first = true;
    let lineIndex = 0;
    chkOptions(opt);
    for (;;) {
        const r = await readRecord(lineIndex, reader, opt);
        if (r === null)
            break;
        lineResult = r;
        lineIndex++;
        // If fieldsPerRecord is 0, Read sets it to
        // the number of fields in the first record
        if (first) {
            first = false;
            if (opt.fieldsPerRecord !== undefined) {
                if (opt.fieldsPerRecord === 0) {
                    _nbFields = lineResult.length;
                }
                else {
                    _nbFields = opt.fieldsPerRecord;
                }
            }
        }
        if (lineResult.length > 0) {
            if (_nbFields && _nbFields !== lineResult.length) {
                throw new ParseError(lineIndex, lineIndex, ERR_FIELD_COUNT);
            }
            result.push(lineResult);
        }
    }
    return result;
}
/**
 * Csv parse helper to manipulate data.
 * Provides an auto/custom mapper for columns and parse function
 * for columns and rows.
 * @param input Input to parse. Can be a string or BufReader.
 * @param opt options of the parser.
 * @returns If you don't provide both `opt.header` and `opt.parse`, it returns `string[][]`.
 *   If you provide `opt.header` but not `opt.parse`, it returns `object[]`.
 *   If you provide `opt.parse`, it returns an array where each element is the value returned from `opt.parse`.
 */
export async function parse(input, opt = {
    header: false,
}) {
    let r;
    if (input instanceof BufReader) {
        r = await readMatrix(input, opt);
    }
    else {
        r = await readMatrix(new BufReader(new StringReader(input)), opt);
    }
    if (opt.header) {
        let headers = [];
        let i = 0;
        if (Array.isArray(opt.header)) {
            if (typeof opt.header[0] !== "string") {
                headers = opt.header;
            }
            else {
                const h = opt.header;
                headers = h.map((e) => {
                    return {
                        name: e,
                    };
                });
            }
        }
        else {
            const head = r.shift();
            assert(head != null);
            headers = head.map((e) => {
                return {
                    name: e,
                };
            });
            i++;
        }
        return r.map((e) => {
            if (e.length !== headers.length) {
                throw `Error number of fields line:${i}`;
            }
            i++;
            const out = {};
            for (let j = 0; j < e.length; j++) {
                const h = headers[j];
                if (h.parse) {
                    out[h.name] = h.parse(e[j]);
                }
                else {
                    out[h.name] = e[j];
                }
            }
            if (opt.parse) {
                return opt.parse(out);
            }
            return out;
        });
    }
    if (opt.parse) {
        return r.map((e) => {
            assert(opt.parse, "opt.parse must be set");
            return opt.parse(e);
        });
    }
    return r;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3N2LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3N2LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFrQjtBQUNsQiwrREFBK0Q7QUFDL0QsbUVBQW1FO0FBQ25FLG1EQUFtRDtBQUNuRCwwRUFBMEU7QUFFMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRTVDLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUV2QyxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsNEJBQTRCLENBQUM7QUFDM0QsTUFBTSxDQUFDLE1BQU0sU0FBUyxHQUFHLHlDQUF5QyxDQUFDO0FBQ25FLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLG1CQUFtQixDQUFDO0FBQ3JELE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyx3QkFBd0IsQ0FBQztBQUV4RCxNQUFNLE9BQU8sVUFBVyxTQUFRLEtBQUs7SUFHbkMsWUFBWSxLQUFhLEVBQUUsSUFBWSxFQUFFLE9BQWU7UUFDdEQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDdkIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztDQUNGO0FBb0JELFNBQVMsVUFBVSxDQUFDLEdBQWdCO0lBQ2xDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2QsR0FBRyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7S0FDakI7SUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFO1FBQ3pCLEdBQUcsQ0FB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