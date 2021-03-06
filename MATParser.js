"use strict";

const fs = require('fs');
const Parser = require('binary-parser').Parser;

function textureDataParser(textures, buffer){
	const p = new Parser()
	.array('textureData', {
		type: Parser.start()
			.endianess('little')
			.int32('sizeX')
			.int32('sizeY')
			.array('_pad', {
				type: 'uint32le',
				length: 3
			})
			.int32('mipMaps')
			.array('data', {
				type: 'uint8',
				length: function(){return this.sizeX * this.sizeY;}
			})
			.skip(function(){ //We don't care even a little about mipmaps. Opengl will do a better job.
				let len = 0;
				for (let i = 1; i < this.mipMaps; ++i){
					len += this.sizeX * this.sizeY / Math.pow(2, i);
				}
				return len;
			}),
		length: textures
	});

	return p.parse(buffer);
}

function textureParser(textures, buffer){
	const p = new Parser()
	.array('textures', {
		type: Parser.start()
			.endianess('little')
			.int32('texType')
			.int32('_colornum')
			.array('_magicValues', {
				type: Parser.start()
					.int32le('_magicValue', {
						assert: (x) => {
							return x === 0x3f800000;
						}
					}),
				length: 4
			})
			.array('_unknown', {
				type: 'int32le',
				length: 2
			})
			.int32('_magicValue2', {
				assert: (x) => {
					//return x === 0xbff78482;
					return true; //This is documented incorrectly?
				}
			})
			.int32('texNum'),
		length: textures
	})
	.array('data', {
		type: 'uint8',
		readUntil: 'eof',
		formatter: (a) => new Buffer(a)
	});
	return p.parse(buffer);
}

const colorParser = new Parser();

const headerParser = new Parser()
.endianess('little')
.string('MAT', {
	length: 4
})
.uint32('MATVER', {
	assert: (x) => {
		return x === 0x32;
	}
})
.int32('type')
.int32('numTex')
.int32('numTex1')
.int32('_zero', {
	assert: (x) => {
		return x === 0;
	}
})
.int32('_eight', {
	assert: (x) => {
		return x === 8;
	}
})
.array('_pad', {
	type: 'int32le',
	length: 12
})
.array('data', {
	type: 'uint8',
	readUntil: 'eof',
	formatter: (a) => new Buffer(a)
});

function importMAT(file){
	return new Promise((resolve, reject)=>{
		fs.readFile(file, function(err, data){
			try {
				const header = headerParser.parse(data);
				const textures = textureParser(header['numTex'], header.data);
				const textureData = textureDataParser(header['numTex'], textures.data);
				resolve(textureData);
			} catch(e) {
				reject(e);
			}
		});
	})
}

function exportPGM(filename, data) {
	return new Promise((resolve, reject)=>{
		data.textureData.forEach((texture, index) => {
			//console.log(texture);
			const data =
				[
					"P2",
					texture['sizeX'],
					texture['sizeY'],
					255
				].join('\n') + '\n' +
				texture.data.map((pixel) => {
					return pixel.toString();
				}).join(' ');

			fs.writeFile(filename + "-" + index + ".pgm", data, "ascii", function(err){
				if (err){
					reject(err);
				}

				resolve();
			});
		});
	});
}

if (require.main !== module) { //Dependency
	module.exports = {exportPGM: exportPGM, importMAT: importMAT};
} else { //Called directly
	if (process.argv.length < 4) {
		console.log("Usage: node MATParser.js [texture] [outFileRoot] -c (color map)\n" +
			"\n" +
			"* Texture is the texture file (a mat file)\n" +
			"* outFileRoot is the root of where the output will be placed " +
			"which could include part of a file name. ex: /test/out could " +
			"result in /test/out-0.pgm and /test/out-1.pgm");
	}

	const argv = require('minimist')(process.argv.slice(2));


}

