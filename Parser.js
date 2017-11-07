class ParserBuilder {
	constructor() {
		/** @type {Array<{name: string, func: Parser?}>} */
		this._groups = [];
		this._regex = null;
	}

	withRegex(regex) {
		this._regex = regex;
		return this;
	}

	withGroup(name, func) {
		this._groups.push({name: name, func: func});
		return this;
	}

	bake() {
		if (this._groups.length === 0 || this._regex === null) {
			throw new Error("Invalid parser configuration!");
		}
		const p = new Parser(this._regex);
		p._groups = this._groups;
		return p;
	}
}

/**
 * @typedef {(Map<*, string|Array<MatchGroup>)} MatchGroup
 * @extends Map
 */

/**
 * Shorthand parsing
 */
class Parser {
	static get Builder() {
		return ParserBuilder;
	};

	/**
	 * @param regex {RegExp}
	 */
	constructor(regex) {
		/** @type {Array<{name: string, func: Parser?}>} */
		this._groups = [];
		this.regex = regex;
	}

	/**
	 * Returns an array of objects corresponding to all of the matches in the data.
	 * @param data
	 * @returns {Array<MatchGroup>}
	 */
	parse(data) {
		const result = [];

		let m;
		while (m = this.regex.exec(data)) {
			const obj = new Map();
			obj.set('_', m[0]);

			for (let i = 0; i < m.length - 1; ++i) {
				let val = m[i + 1];
				if (this._groups[i]) {
					if (this._groups[i].func) {
						val = this._groups[i].func.parse(m[i + 1]);
					}
					obj.set(this._groups[i].name, val);
				}
				obj.set(i, val);
			}
			result.push(obj);
		}

		return result;
	}
}

module.exports = Parser;
