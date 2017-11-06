"use strict";

if (process.argv.length < 4) {
	console.log("Usage: node Convert.js [input.jkl] [output.obj]");
	return;
}

const fs = require('fs');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));

const level = argv['_'][0];
const output = argv['_'][1];

fs.readFile(level, (err, data) => {

	if (err) {
		return console.error(err);
	}

	const geoData = geoParse(data);

	addSections(data, geoData);

	generateObj(geoData);

});

class LevelData {
	constructor() {

		this.verts = [];
		this.uvs = [];
		this.faces = [];
		this.palette = [];
		this.normals = [];
		/** @type {Array<{start: Number, count: Number}>} */
		this.sectors = [];
	}
}

function generateObj(levelData) {

	let finalVerts = new Set();

	const finalFaces = levelData.faces.filter((face) => {
		return face.adj === -1; //We only want non adjoin faces.
	});

	finalFaces.forEach((face) => {
		face.verts.forEach((vert) => {
			if (!finalVerts.has(vert)) {
				finalVerts.add(vert);
			}
		});
	});

	finalVerts = Array.from(finalVerts); //Convert to array so we have an order

	const out = fs.createWriteStream(output);

	//Save the vertices to the file, it can write while we work.
	out.write(finalVerts.map((vert) => {
		return 'v ' + levelData.verts[vert[0]].join(' '); //Accumulate vertices from indexes.
	}).join('\n') + '\n\n', (err) => {
		if (err) {
			throw err;
		}
	});

	const searchVerts = finalVerts.reduce((ret, val, index) => { //Make a searchable version.
		ret[val[0]] = index + 1; //Obj files use 1 for the start of their lists.
		return ret;
	}, {});

	//Write out all of the normals.
	out.write(finalFaces.map((face) => {
		return 'vn ' + levelData.normals[face.index].join(' ');
	}).join('\n') + '\n\n', (err) => {
		if (err) {
			throw err;
		}
	});

	let normalIndex = 0;

	//Write out all of the sectors
	levelData.sectors.forEach((sector, index) => {
		out.write("o sector" + index + "\n");

		for (let i = sector.start; i < sector.start + sector.count; ++i) {
			if (levelData.faces[i].adj !== -1) {
				continue; //Skip adjoin faces
			}
			out.write('f ' + levelData.faces[i].verts.map((vert) => {
				return searchVerts[vert[0]] + '//' + (normalIndex + 1); //Convert to new index and add the normal with its position (its equal to the face index + 1)
			}).join(' ') + '\n');
			normalIndex++;
		}
		out.write("\n");
	});

	//Not capable of handling textures yet. (Need to convert the textures themselves.)

	//Not capable of handling objects yet. (Need to read in every obj that is part of the scene and duplicate it for everywhere it needs to go)

	//No lights in objs.

	out.end();
}

/**
 * Creates all of the geo data info
 *
 * @param data {string}
 * @returns {LevelData}
 */
function geoParse(data) {
	const geoReg = /SECTION: GEORESOURCE\s*([\w\s\-#\d:.,]+?)SECTION:/i;
	const geo = geoReg.exec(data)[1].split('World');

	const testReg = /^\s+(\w+)/m;

	const ret = new LevelData();

	geo.forEach((val) => {
		const subSec = (testReg.exec(val) || {})[1];
		if (!subSec) return;
		switch (subSec) {
			case "vertices":
				ret.verts = vertParser(val);
				break;
			case "texture":
				ret.uvs = uvParser(val);
				break;
			case "Colormaps":
				ret.palette = paletteParser(val);
				break;
			case "surfaces":
				ret.faces = surfParser(val);
				ret.normals = vertParser(val);
				break;
			default:
				console.log("No parser for", subSec);
		}
	});

	return ret;
}

function vertParser(dat) {
	const vertReg = /\d+:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

	let m;
	const verts = [];

	while (m = vertReg.exec(dat)) {
		verts.push([Number(m[1]), Number(m[2]), Number(m[3])]);
	}

	return verts;
}

function uvParser(dat) {
	const uvReg = /\d+:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

	let m;
	const uvs = [];

	while (m = uvReg.exec(dat)) {
		uvs.push([Number(m[1]), Number(m[2])]);
	}

	return uvs;
}

function paletteParser(dat) {
	const paletteReg = /\d+:\s+(\d+\w+\.cmp)/g;

	let m;
	const palettes = [];

	while (m = paletteReg.exec(dat)) {
		palettes.push(m[1]); //Strings
	}

	return palettes;
}

function surfParser(dat) {
	//Ya, pretty gross, targets the index, material, texture, adjoin #, nverts, (verts list)
	const surfaceReg = /(\d+):\s+(-?\d+)\s+[^\s]+\s+[^\s]+\s+\d+\s+\d+\s+(\d+)\s+(-?\d+)\s+\d+(?:\.\d+)?\s+(\d+)\s+((?:\d+,-?\d+\s+)+)(?:(?:\d+)?\.\d+\s+)+/g;

	//We will need to do a second stage of parsing for verts.

	let m;
	const surfaces = [];

	while (m = surfaceReg.exec(dat)) {
		const nverts = Number(m[5]);
		const surf = {
			index: Number(m[1]),
			mat: Number(m[2]),
			tex: Number(m[3]),
			adj: Number(m[4]),
			verts: []
		};

		surf.verts = m[6].trim().split(/\s+/).map((val) => {
			return val.split(',').map(Number);
		});

		if (surf.verts.length !== nverts) {
			console.warn("Vert length mismatch!");
		}
		// Intensity was impossible to convert to obj, so it was removed.
		// surf.ints = m[7].trim().split(/\s+/).map(Number);
		//
		// if (surf.ints.lenth !== nverts){
		// 	console.warn("Intensity length mismatch!");
		// }

		surfaces.push(surf);
	}

	return surfaces;
}

function addSections(data, levelData) {
	const sectionReg = /SURFACES\s+(\d+)\s+(\d+)/g;

	let m;

	while (m = sectionReg.exec(data)) {
		levelData.sectors.push({start: Number(m[1]), count: Number(m[2])});
	}

}
