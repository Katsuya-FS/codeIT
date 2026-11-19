const tokenPattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|[{}()[\];,.=+\-*/%!<>]/y;

function tokenize(source) {
  const tokens = [];
  let offset = 0;
  while (offset < source.length) {
    tokenPattern.lastIndex = offset;
    const match = tokenPattern.exec(source);
    if (!match) throw new Error(`Unsupported Java character near: ${source.slice(offset, offset + 12)}`);
    offset = tokenPattern.lastIndex;
    const token = match[0];
    if (!/^\s+$/.test(token) && !token.startsWith('//') && !token.startsWith('/*')) tokens.push(token);
    if (tokens.length > 20_000) throw new Error('The program is too large for this learning interpreter.');
  }
  return tokens;
}

const precedence = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const javaTypes = new Set(['int', 'long', 'double', 'float', 'boolean', 'String', 'char']);

class Parser {
  constructor(tokens) { this.tokens = tokens; this.index = 0; }
  peek(ahead = 0) { return this.tokens[this.index + ahead]; }
  take(expected) {
    const token = this.tokens[this.index++];
    if (expected && token !== expected) throw new Error(`Expected "${expected}" but found "${token ?? 'end of program'}".`);
    return token;
  }
  is(value) { return this.peek() === value; }
  mainBody() {
    while (this.index < this.tokens.length && !(this.is('main') && this.peek(1) === '(')) this.index++;
    if (this.index >= this.tokens.length) throw new Error('Add a public static void main(String[] args) method.');
    this.take('main'); this.take('(');
    let depth = 1;
    while (depth && this.index < this.tokens.length) { const token = this.take(); if (token === '(') depth++; if (token === ')') depth--; }
    if (depth) throw new Error('The main method parameters are not closed.');
    this.take('{');
    const statements = [];
    while (!this.is('}') && this.index < this.tokens.length) statements.push(this.statement());
    this.take('}');
    return statements;
  }
  statement() {
    if (this.is(';')) { this.take(';'); return { type: 'empty' }; }
    if (this.is('{')) {
      this.take('{'); const body = [];
      while (!this.is('}') && this.index < this.tokens.length) body.push(this.statement());
      this.take('}'); return { type: 'block', body };
    }
    if (this.is('if')) {
      this.take('if'); this.take('('); const test = this.expression(); this.take(')');
      const yes = this.statement(); const no = this.is('else') ? (this.take('else'), this.statement()) : null;
      return { type: 'if', test, yes, no };
    }
    if (this.is('while')) {
      this.take('while'); this.take('('); const test = this.expression(); this.take(')');
      return { type: 'while', test, body: this.statement() };
    }
    if (this.is('for')) return this.forStatement();
    if (this.is('return')) { this.take('return'); if (!this.is(';')) this.expression(); this.take(';'); return { type: 'empty' }; }
    if (this.is('System') && this.peek(1) === '.' && this.peek(2) === 'out' && this.peek(3) === '.') return this.printStatement();
    if (this.is('Scanner')) return this.scannerDeclaration();
    return this.simpleStatement(';');
  }
  scannerDeclaration() {
    this.take('Scanner'); const name = this.take(); this.take('='); this.take('new'); this.take('Scanner');
    this.take('('); this.take('System'); this.take('.'); this.take('in'); this.take(')'); this.take(';');
    return { type: 'declareScanner', name };
  }
  printStatement() {
    this.take('System'); this.take('.'); this.take('out'); this.take('.');
    const method = this.take(); if (method !== 'print' && method !== 'println') throw new Error('Only System.out.print and println are supported.');
    this.take('('); const value = this.is(')') ? null : this.expression(); this.take(')'); this.take(';');
    return { type: 'print', value, newline: method === 'println' };
  }
  forStatement() {
    this.take('for'); this.take('(');
    const init = this.is(';') ? null : this.simpleStatement(null); this.take(';');
    const test = this.is(';') ? { type: 'literal', value: true } : this.expression(); this.take(';');
    const update = this.is(')') ? null : this.simpleStatement(null); this.take(')');
    return { type: 'for', init, test, update, body: this.statement() };
  }
  simpleStatement(terminator) {
    if (javaTypes.has(this.peek()) && this.peek(1) && this.peek(1) !== '(') {
      const kind = this.take(); const name = this.take(); this.take('='); const value = this.expression();
      if (terminator === ';') this.take(';');
      return { type: 'declare', kind, name, value };
    }
    const name = this.take();
    let op;
    if (['++', '--', '+=', '-=', '*=', '/=', '='].includes(this.peek())) op = this.take();
    else throw new Error(`Unsupported statement near "${name}".`);
    const value = op === '++' ? { type: 'literal', value: 1 } : op === '--' ? { type: 'literal', value: 1 } : this.expression();
    if (terminator === ';') this.take(';');
    return { type: 'assign', name, op, value };
  }
  expression(min = 0) {
    let left = this.unary();
    while (precedence[this.peek()] !== undefined && precedence[this.peek()] >= min) {
      const op = this.take(); const level = precedence[op]; const right = this.expression(level + 1);
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  unary() {
    if (['!', '-', '+'].includes(this.peek())) { const op = this.take(); return { type: 'unary', op, value: this.unary() }; }
    let value = this.primary();
    while (this.is('.')) {
      this.take('.'); const method = this.take(); this.take('(');
      const args = this.is(')') ? [] : [this.expression()]; this.take(')');
      value = { type: 'memberCall', target: value, method, args };
    }
    return value;
  }
  primary() {
    const token = this.take();
    if (token === '(') { const value = this.expression(); this.take(')'); return value; }
    if (token === 'true' || token === 'false') return { type: 'literal', value: token === 'true' };
    if (/^\d+(?:\.\d+)?$/.test(token)) return { type: 'literal', value: Number(token) };
    if (token.startsWith('"')) return { type: 'literal', value: JSON.parse(token) };
    if (token.startsWith("'")) return { type: 'literal', value: token.slice(1, -1).replace(/\\'/g, "'") };
    if (/^[A-Za-z_$][\w$]*$/.test(token)) return { type: 'variable', name: token };
    throw new Error(`Unsupported expression near "${token}".`);
  }
}

function runProgram(statements, input) {
  const variables = new Map(); const stdin = input.match(/\S+/g) ?? []; let inputIndex = 0;
  let output = ''; let steps = 0;
  const tick = () => { if (++steps > 150_000) throw new Error('The program exceeded the instruction limit.'); };
  const readInput = (method) => {
    const token = stdin[inputIndex++];
    if (token === undefined) throw new Error('The program requested more input than provided.');
    if (method === 'nextInt') { if (!/^[+-]?\d+$/.test(token)) throw new Error('Expected a whole number in standard input.'); return Number.parseInt(token, 10); }
    return token;
  };
  const evaluate = (node) => {
    tick();
    if (node.type === 'literal') return node.value;
    if (node.type === 'variable') {
      if (!variables.has(node.name)) throw new Error(`Variable "${node.name}" is not defined.`);
      return variables.get(node.name);
    }
    if (node.type === 'unary') { const value = evaluate(node.value); return node.op === '!' ? !value : node.op === '-' ? -Number(value) : Number(value); }
    if (node.type === 'memberCall') {
      const target = evaluate(node.target);
      if (target?.kind === 'scanner' && (node.method === 'nextInt' || node.method === 'next')) return readInput(node.method);
      if (node.method === 'length' && node.args.length === 0 && typeof target === 'string') return target.length;
      if (node.method === 'charAt' && node.args.length === 1 && typeof target === 'string') {
        const index = Number(evaluate(node.args[0])); if (!Number.isInteger(index) || index < 0 || index >= target.length) throw new Error('String index is out of range.'); return target[index];
      }
      throw new Error(`The method ${node.method}() is outside the supported Java subset.`);
    }
    const left = evaluate(node.left);
    if (node.op === '&&' && !left) return false;
    if (node.op === '||' && left) return true;
    const right = evaluate(node.right);
    switch (node.op) {
      case '+': return typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : Number(left) + Number(right);
      case '-': return Number(left) - Number(right);
      case '*': return Number(left) * Number(right);
      case '/': if (Number(right) === 0) throw new Error('Division by zero.'); return Number.isInteger(left) && Number.isInteger(right) ? Math.trunc(left / right) : Number(left) / Number(right);
      case '%': if (Number(right) === 0) throw new Error('Division by zero.'); return Number(left) % Number(right);
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return left < right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '>=': return left >= right;
      case '&&': return Boolean(left) && Boolean(right);
      case '||': return Boolean(left) || Boolean(right);
      default: throw new Error('Unsupported operator.');
    }
  };
  const execute = (node) => {
    tick();
    switch (node.type) {
      case 'empty': break;
      case 'block': for (const child of node.body) execute(child); break;
      case 'declareScanner': variables.set(node.name, { kind: 'scanner' }); break;
      case 'declare': variables.set(node.name, evaluate(node.value)); break;
      case 'assign': {
        if (!variables.has(node.name)) throw new Error(`Variable "${node.name}" is not defined.`);
        const old = variables.get(node.name); const value = evaluate(node.value);
        variables.set(node.name, node.op === '=' ? value : node.op === '++' ? Number(old) + 1 : node.op === '--' ? Number(old) - 1 : node.op === '+=' ? (typeof old === 'string' ? old + String(value) : Number(old) + Number(value)) : node.op === '-=' ? Number(old) - Number(value) : node.op === '*=' ? Number(old) * Number(value) : Number(old) / Number(value)); break;
      }
      case 'print': if (node.value) output += String(evaluate(node.value)); if (node.newline) output += '\n'; if (output.length > 20_000) throw new Error('Program output exceeded 20,000 characters.'); break;
      case 'if': execute(evaluate(node.test) ? node.yes : node.no ?? { type: 'empty' }); break;
      case 'while': { let loops = 0; while (evaluate(node.test)) { execute(node.body); if (++loops > 10_000) throw new Error('Loop exceeded 10,000 iterations.'); } break; }
      case 'for': { if (node.init) execute(node.init); let loops = 0; while (evaluate(node.test)) { execute(node.body); if (node.update) execute(node.update); if (++loops > 10_000) throw new Error('Loop exceeded 10,000 iterations.'); } break; }
      default: throw new Error('Unsupported Java statement.');
    }
  };
  for (const statement of statements) execute(statement);
  return output;
}

export function interpretJavaSubset(code, input = '') {
  if (typeof code !== 'string' || code.length > 50_000) throw new Error('Source code must be under 50,000 characters.');
  if (typeof input !== 'string' || input.length > 10_000) throw new Error('Standard input must be under 10,000 characters.');
  return runProgram(new Parser(tokenize(code)).mainBody(), input);
}

export function evaluateJavaSubmission(code, customInput, cases) {
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 50) throw new Error('The challenge test set is invalid.');
  const output = interpretJavaSubset(code, customInput);
  const checks = cases.map((test) => {
    try { return interpretJavaSubset(code, test.input).replace(/\r\n/g, '\n').trimEnd() === String(test.expected).replace(/\r\n/g, '\n').trimEnd(); }
    catch { return false; }
  });
  return { output, checks };
}
