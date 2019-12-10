var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const Joi = require('@hapi/joi');
const ytdl = require('ytdl-core');
const MediaSplit = require('media-split');
const ffmpeg = require('fluent-ffmpeg');
// use ffmpeg-installer to set the ffmpeg path
if (process.platform === 'win32') {
	const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
	ffmpeg.setFfmpegPath(ffmpegPath);
}

const schema = Joi.object({
	url: Joi.string().uri(),
	dir: Joi.string().pattern(/[a-zA-z0-9\/\.]/).trim().allow(''),
	startH: Joi.string().pattern(/[0-9]/).allow(''),
	startM: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	startS: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	endH: Joi.string().pattern(/[0-9]/).allow(''),
	endM: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	endS: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	artist: Joi.string().trim().allow(''),
	title: Joi.string().trim(),
	version: Joi.string().trim().allow(''),
	artistInFilename: Joi.string()
});

let snek = 'https://www.youtube.com/watch?v=0arsPXEaIUY';
let eatshitbob = 'https://www.youtube.com/watch?v=UN8bJb8biZU';
let comeAlong = 'https://www.youtube.com/watch?v=u8rT6ij0PSo';

router.get('/', function(req, res, next) {
	res.render('index.ejs');
});

/* test case for media-split */
router.post('/save-audio-media-split', function(req, res, next) {
	let split = new MediaSplit({
		input: comeAlong,
		sections: ['[00:05 - 03:05] Come Along'],
		output: '/Users/janice/Music',
		audioonly: true,
		quality: 'highestaudio',
		downloadCover: false
	});
	split.parse().then((sections) => {
	  for (let section of sections) {
	    console.log(section.name);      // filename
	    console.log(section.start);     // section start
	    console.log(section.end);       // section end
	    console.log(section.trackName); // track name
	  }
	  res.status(200).end();
	});

})

/* convert and save audio from YouTube video. */
router.post('/save-audio', async function(req, res, next) {

	let validated = schema.validate(req.body);
	let format = 'mp3';

	if (validated.error) {
		console.log(validated.error);
		throw new Error(400);
	}

	let values = validated.value;

	console.log('converting "' + values.title + '"...');

	let stream = ytdl(values.url, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	// tagging
	let versionTxt = values.version ? ` [${values.version}]` : '';

	let artistTxt = (values.artist && values.artistInFilename) ? `${values.artist} - ` : '';

	let filename = artistTxt + values.title + versionTxt;

	let dir = (values.dir !== '') ? values.dir : './';

	let startTimeInSeconds = 0, endTimeInSeconds = 0;

	// start time
	startTimeInSeconds += values.startH  ? parseInt(values.startH) * 3600 : 0;

	startTimeInSeconds += values.startM ? parseInt(values.startM) * 60 : 0;

	startTimeInSeconds += values.startS ? parseInt(values.startS) : 0;

	// end time
	endTimeInSeconds += values.endH ? parseInt(values.endH) * 3600 : 0;

	endTimeInSeconds += values.endM ? parseInt(values.endM) * 60 : 0;

	endTimeInSeconds += values.endS ? parseInt(values.endS) : 0;


	// Start converting
	let audio = ffmpeg(stream);

	audio.outputOptions('-metadata', `title=${values.title}${versionTxt}`);
	audio.outputOptions('-metadata', `artist=${values.artist}`);
	audio.outputOptions('-metadata', `album=${values.version}`);

	audio = audio.seekInput(startTimeInSeconds);
	let finalFilename = await checkFileExists(dir, filename, 0, '.' + format);
	console.log('finalFilename:', finalFilename);
	let filepath = path.join(dir, finalFilename);

	if (endTimeInSeconds > 0) {
		let duration = endTimeInSeconds - startTimeInSeconds;
		let endTime = getEndTimeFormatted(endTimeInSeconds - startTimeInSeconds);
		let uncutSrc = filepath + '_uncut.' + format;

		audio.setDuration(duration)
		.save(uncutSrc).on('end', () => {
			console.log('saved file for trimming', uncutSrc);
			let range = '00:00 - ' + endTime;
			trimAudio({
				inputSrc: uncutSrc,
				dir: dir,
				filename: finalFilename,
				format: format,
				range: range
			}).then(() => {
				console.log('Conversion and trimming complete!', finalFilename + '.' + format);
				res.status(200).send('finished trimming file.');
			}).catch(err => {
				console.error(err);
				res.status(500).send(err.message);
			});
		});
	} else {
		console.log('no trimming required');
		finalFilename += '.' + format;
		audio.save(finalFilename).on('end', () => {
			console.log('finished saving w/o trimming', finalFilename);
			res.status(200).send('file finished saving');
		});
	}
});

router.post('/save-video', function(req, res, next) {

	let artistTxt = req.body.artist ? `${req.body.artist} - ` : '';

	let filename = artistTxt + req.body.title;

	let filepath = req.body.dir ? path.join(req.body.dir, filename) : filename;

	let stream = ytdl(req.body.url, {
		quality: 'highestvideo'
	}).pipe(fs.createWriteStream(filepath + '.mp4'));

	stream.on('finish', () => {
		res.status(200).send('file finished saving');
	})
})

/* GET home page. */
router.get('/test-audio', function(req, res, next) {
	let stream = ytdl(snek, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	ffmpeg(stream)
	.audioBitrate(128)
	.save('noperopes.mp3')
	.on('end', (p) => {
		res.status(200).send('file finished saving');
	});
});

/* GET eat shit bob video */
router.get('/test-video', function(req, res, next) {
	let stream = ytdl(eatshitbob, {
		// quality: 'highestvideo',
		begin: '20:60'
	}).pipe(fs.createWriteStream('eatshitbob.mp4'));

	stream.on('finish', () => {
		res.status(200).send('file finished saving');
	})
});

router.get('/get-info', function(rea, res, next) {
	ytdl.getInfo(snek).then(result => {
		res.status(200).send(result);
	}).catch(err => {
		res.status(err.code).send(err);
	})
});

// Checks if the file of the same name exists and changes the filename if it does.
function checkFileExists(dir, originalFilename, count, extension) {
	return new Promise((resolve, reject) => {
		let newPath = path.join(dir, originalFilename) + (count > 0 ? `_(${count})` : '') + extension;
		fs.access(newPath, fs.constants.F_OK, (err) => {
			if (err) {
				console.log(newPath, 'does not exist');
				let newName = originalFilename + (count > 0 ? `_(${count})` : '');
				resolve(newName);
			} else {
				console.log(newPath, 'exists');
				//file exists
				count += 1;
				resolve(checkFileExists(dir, originalFilename, count, extension));
			}
		});
	});
}

function formatStartTime(h, m, s) {
	let hFormatted = h ? padStartZeros(h) + ':' : '';
	let mFormatted = m ? padStartZeros(m) + ':' : '00:';
	let sFormatted = s ? padStartZeros(s) : '00';

	let formatted = hFormatted + mFormatted + sFormatted;
	return formatted;
}

function getEndTimeFormatted(s) {
	let hours = Math.floor(s/60);
	let seconds = s % 60;
	let minutes = hours % 60;
	hours = Math.floor(hours/60);

	let hFormatted = hours ? padStartZeros(hours) + ':' : '';
	let mFormatted = minutes ? padStartZeros(minutes) + ':' : '00:';
	let sFormatted = seconds ? padStartZeros(seconds) : '00';

	let formatted = hFormatted + mFormatted + sFormatted;
	return formatted;
}

function padStartZeros(num) {
	// pad the start with zeros then take the last two characters.
	return String(num).padStart(2, '0').slice(-2);
}

function trimAudio(options) {
	console.log('trimming audio...', options.inputSrc, options.dir, options.filename, options.range);
	return new Promise(async (resolve, reject) => {
		try {
			// let targetFilename = await checkFileExists(dir, options.filename, 0, options.format);
			let split = new MediaSplit({
				input: options.inputSrc,
				sections: [`[${options.range}] ${options.filename}`],
				output: options.dir,
				quality: 'highestaudio'
			});
			split.parse().then((sections) => {
			  for (let section of sections) {
			    console.log('saved:', section.name, section.start, '-', section.end);
			  }
			  fs.unlink(options.inputSrc, function(err) {
			  	if (err) {
			  		console.error(err);
			  		reject(err);
			  	}
			  	resolve('Removed uncut audio file.');
			  })
			});
		} catch(err) {
			reject(err);
		}
	});
}

module.exports = router;
