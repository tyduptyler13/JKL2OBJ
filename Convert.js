"use strict";

const fs = require('fs');

if (process.argv.length < 4){
	console.log("Usage: node Convert.js [input.jkl] [output.obj]");
	return;
}

var level = process.argv[2];
var output = process.argv[3];

fs.readFile(level, (err, data) => {

	if (err){
		return console.error(err);
	}

	var geoData = geoParse(data);

	generateObj(geoData);

});

function generateObj(geoData){

	var finalVerts = new Set();

	var finalFaces = geoData.faces.filter((face) => {
		return face.adj === -1; //We only want non adjoin faces.
	});

	finalFaces.forEach((face) => {
		face.verts.forEach((vert) => {
			if (!finalVerts.has(vert)){
				finalVerts.add(vert);
			}
		});
	});

	finalVerts = Array.from(finalVerts); //Convert to array so we have an order

	//Save the vertices to the file, it can write while we work.
	fs.writeFile(output, finalVerts.map((vert) => {
		return 'v ' + geoData.verts[vert[0]].join(' '); //Accumulate vertices from indexes.
	}).join('\n') + '\n\n', (err) => {
		if (err){
			console.error("Failed to write verts", err);
		}
	});

	var searchVerts = finalVerts.reduce((ret, val, index) => { //Make a searchable version.
		ret[val[0]] = index + 1; //Obj files use 1 for the start of their lists.
		return ret;
	}, {});

	//Write out all of the normals.
	fs.appendFile(output, finalFaces.map((face) => {
		return 'vn ' + geoData.normals[face.index].join(' ');
	}).join('\n') + '\n\n', (err) => {
		if (err){
			console.error("Failed to write normals", err);
		}
	});

	//Write out all of the faces.
	fs.appendFile(output, finalFaces.map((face, index) => {
		return 'f ' + face.verts.map((vert) => {
			return searchVerts[vert[0]] + '//' + (index + 1); //Convert to new index and add the normal with its position (its equal to the face index + 1)
		}).join(' ');
	}).join('\n') + '\n\n', (err) => {
		if (err){
			console.error("Failed to write faces", err);
		}
	});

	//Not capable of handling textures yet. (Need to convert the textures themselves.)

	//Not capable of handling objects yet. (Need to read in every obj that is part of the scene and duplicate it for everywhere it needs to go)

	//No lights in objs.

}

function geoParse(data) {
	const geoReg = /SECTION: GEORESOURCE\s*([\w\s\-#\d:.,]+?)SECTION:/i;
	var geo = geoReg.exec(data)[1].split('World');

	var testReg = /^\s+(\w+)/m;

	var ret = {
		verts: [],
		uvs: [],
		faces: [],
		palette: [],
		normals: []
	};

	geo.forEach((val) => {
		var subSec = (testReg.exec(val) || {})[1];
		if (!subSec) return;
		switch(subSec){
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

function vertParser(dat){
	const vertReg = /\d+:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

	var m;
	var verts = [];

	while(m = vertReg.exec(dat)){
		verts.push([Number(m[1]), Number(m[2]), Number(m[3])]);
	}

	return verts;
}

function uvParser(dat){
	const uvReg = /\d+:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

	var m;
	var uvs = [];

	while(m = uvReg.exec(dat)){
		uvs.push([Number(m[1]), Number(m[2])]);
	}

	return uvs;
}

function paletteParser(dat){
	const paletteReg = /\d+:\s+(\d+\w+\.cmp)/g;

	var m;
	var palettes = [];

	while(m = paletteReg.exec(dat)){
		palettes.push(m[1]); //Strings
	}

	return palettes;
}

function surfParser(dat){
	//Ya, pretty gross, targets the index, material, texture, adjoin #, nverts, (verts list)
	const surfaceReg = /(\d+):\s+(-?\d+)\s+[^\s]+\s+[^\s]+\s+\d+\s+\d+\s+(\d+)\s+(-?\d+)\s+\d+(?:\.\d+)?\s+(\d+)\s+((?:\d+,-?\d+\s+)+)(?:(?:\d+)?\.\d+\s+)+/g;

	//We will need to do a second stage of parsing for verts.

	var m;
	var surfaces = [];

	while(m = surfaceReg.exec(dat)){
		var nverts = Number(m[5]);
		var surf = {
			index: Number(m[1]),
			mat: Number(m[2]),
			tex: Number(m[3]),
			adj: Number(m[4]),
			verts: []
		};

		surf.verts = m[6].trim().split(/\s+/).map((val) => {
			return val.split(',').map(Number);
		});

		if (surf.verts.length !== nverts){
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
