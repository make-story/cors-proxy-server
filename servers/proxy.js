/*
로컬 주소가 아니거나,
CROSS 문제가 발생하는 URL 처리를 위한,
NodeJS 기반 프록시서버
*/
const path = require('path'); 
const fs = require('fs');
const puppeteer = require("puppeteer"); // 헤드리스 크롬 (https://pptr.dev/) - $ sudo npm install puppeteer --unsafe-perm=true --allow-root
const express = require('express'); // 너무 무겁다.. Koa 로 변경하자 
//const cors = require('cors'); // CORS 미들웨어 
const app = express(); 

const PORT = 3291;
const TYPE_MOBILE = 'mobile';
const TYPE_PC = 'pc';
const TYPE_JSON = 'json';
const TYPE_TEXT = 'text';
const TYPE_HTML = 'html';

// unable to verify the first certificate 에러 발생할 경우 설정
// SSL validate 과정에서 실패하면 해당 오류 발생, SSL validate 를 하지 않겠다는 설정으로 진행 (주의!)
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const browserOpen = async () => {
	// 브라우저 인스턴스 실행하기
	let browser = await puppeteer.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
		],
		//executablePath: '/path/to/Chrome', // 다른 버전의 Chrome 또는 Chromium에서 Puppeteer를 사용을 위한 실행 파일 경로
	});
	return Promise.resolve(browser);
};
const browserClose = async browser => {
	// 브라우저 인스턴스 종료
	return Promise.resolve(await browser.close());
};
const browserContext = async browser => {
	// 브라우징 콘텍스트 생성하기 (사용자별로 독립된 공간)
	let browserContext = await browser.createIncognitoBrowserContext();
	return Promise.resolve(browserContext);
};
const pageOpen = async browserContext => {
	// 페이지 생성하기 (탭에 해당)
	let page = await browserContext.newPage();
	await page.setRequestInterception(true); // request 중간 조건에 따라 중지/계속 처리 여부
	await page.setCacheEnabled(false); // 캐시 사용 여부 
	/*await page.setExtraHTTPHeaders({ // headers 공통 주입 
		'Pragma': 'no-store',
		'Cache-Control': 'no-store',
	});*/
	return Promise.resolve(page);
};
const pageClose = async page => {
	return Promise.resolve(await page.close());
};
const pageEvent = async page => {
	// 페이지 이벤트 설정 
	//page.on('console', msg => console.log(`page console log: ${msg.text()}`)); // 브라우저내 출력되는 콘솔 로그
	page.on('request', (request) => {
		const headers = request.headers();
		//console.log('request', request);
		//console.log('request headers', headers);

		delete headers.host; // 크롬 정책에 따라 host 변경시 에러 발생 
		//delete headers.origin;

		// setRequestInterception 설정에 따라 멈춤/실행 제어 가능 
		request.continue({ headers });
	});
	page.on('requestfailed', (request) => {

	});
	page.on('requestfinished', (request) => {

	});
	page.on('response', (response) => {
		//const headers = response.headers();
		//console.log('response', response);
		//console.log('response headers', headers);
	});
	page.on('pageerror', (error) => {
		console.error('page error!', error);
	});
	page.on('close', () => {
		console.log('page close...');
	});
	page.on('error', (error) => {
		console.error('error!', error);
	});
	return Promise.resolve(page);
};
const pageEventRemove = async page => {
	//page.removeListener('request', <listener>);
};
const pageEmulate = async (page, {devices, userAgent, viewport}={}) => {
	// Puppeteer versions <= v1.14.0 : require('puppeteer/DeviceDescriptors')
	// https://github.com/puppeteer/puppeteer/blob/master/lib/DeviceDescriptors.js
	if(devices) {
		// userAgent 와 viewPort 한번에 실행
		await page.emulate(devices);
	}else {
		// 각각 실행 
		userAgent && await page.setUserAgent(userAgent);
		await page.setViewport(Object.assign({
			width: 640,
			height: 480,
			deviceScaleFactor: 1,
			isMobile: true, // meta viewport태그가 고려 되는지 여부
			hasTouch: false, // 뷰포트가 터치 이벤트를 지원하는지 여부
			isLandscape: false, // 뷰포트가 가로 모드인지를 지정
		}, viewport));
	}
	return Promise.resolve(page);
};
const pageHeaders = async (page, headers={}) => {
	if(Object.keys(headers).length) {
		await page.setExtraHTTPHeaders(headers);
	}
	return Promise.resolve(page);
};
const pageCookies = async (page, cookies={}) => {
	await page.setCookie(cookies); // {name: 필수, value: 필수, url, domain, path, expires, httpOnly, secure, sameSite}
	return Promise.resolve(page);
};
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication
// 407 (Proxy Authentication Required)
const pageAuthenticate = async (page, credentials={}) => {
	await page.authenticate(credentials); // { username: '', password: '' }
	return Promise.resolve(page);
};
const pageSetting = async (page, {scriptTag={}, styleTag={}, offline=false}={}) => {
	await page.addScriptTag(scriptTag); // {url, path, content, type}
	await page.addStyleTag(styleTag); // {url, path, content}
	await page.setOfflineMode(offline);
	return Promise.resolve(page);
};
const pageGoto = async (page, url='') => {
	console.log(`proxy request url: ${url}`);
	//console.log('viewport', page.viewport());
	
	// page URL 입력 
	const response = await page.goto(url, {
		//timeout: 0,
		//referer: '',
		waitUntil: "networkidle0"
	});
	const html = await page.content();

	//console.log(TYPE_HTML, html);
	//console.log('status', response.status()); // 응답 코드 
	//console.log('headers', response.headers()); // 응답 헤더 
	//console.log('fromCache', response.fromCache()); // 브라우저 캐시에서 반환여부
	//console.log('fromServiceWorker', response.fromServiceWorker()); // 서비스워커에서 반환여부

	// 상태확인 
	if(response.ok()) { // 응답 성공여부 status in the range 200-299
		const text = await response.text();
		//console.log(TYPE_TEXT, text);
		let json = {};
		try {
			json = await response.json();
		}catch(e) {
			json = {};
		}
		//console.log(TYPE_JSON, json);
		return Promise.resolve({response, html, json, text});
	}else {
		return Promise.reject(response.status());
	}
};
const pageEvaluate = async page => {
	await page.evaluate(() => console.log(`href: ${window.location.href}`)); // 브라우저 내에서 코드 실행
	return Promise.resolve(page);
};
const route = async (page, request, response) => {
	const { method, protocol, httpVersion, headers={}/*{}형태*/, rawHeaders=[]/*[]형태*/, subdomains/*subdomain.xxx.com*/, originalUrl, baseUrl, /*url,*/ path, cookies, params/*url/:값*/, query/*url?parameter*/, body/*post body*/ } = request;
	const { deviceType=''/*디바이스 타입 */, dataType=''/*응답 데이터 타입*/, everyType=''/*디바이스 또는 응답 데이터 타입*/ } = params;
	let url = params['0'] ? `http://${params['0']}` : ''; // 요청 URL
	let search = request._parsedUrl.search; // ?key=value& ... GET 파라미터 
	
	//console.log('deviceType', deviceType);
	//console.log('dataType', dataType);
	//console.log('everyType', everyType);
	//console.log('request', request);
	//console.log('headers', headers);
	//console.log('cookies', cookies);

	// 유효성 검사 
	if(page.isClosed()) {
		// 새로운 페이지 생성해야 한다.
		// ...
		return response.send('');
	}else if(!url) {
		return response.send('');
	}

	// 페이지 설정 (과거 페이지 호출당시의 설정 존재 주의)
	await pageHeaders(page, (() => {
		if(everyType === 'header') {
			return headers;
		}
		const public = ['accept', 'accept-encoding', 'cookie']; // 허용 헤더 
		return Object.keys(headers).filter(key => public.includes(key) && headers[key]).reduce((accumulator, currentValue, currentIndex, array) => {
			accumulator[currentValue] = headers[currentValue];
			return accumulator;
		}, {});
	})());
	//await pageCookies(page, {});
	//await pageSetting(page, {});
	if([deviceType, everyType].includes(TYPE_MOBILE)) {
		await pageEmulate(page, {devices: puppeteer.devices['iPhone 6']});
	}

	// 호출 
	pageGoto(page, search ? `${url}${search}` : url)
	.then(({response: pageResponse, json, text, html}) => {
		response.header("Access-Control-Allow-Origin", "*");
		response.header("Access-Control-Allow-Headers", "X-Requested-With");
		switch(dataType || everyType) {
			case TYPE_TEXT:
				response.send(text);
				break;
			case TYPE_HTML:
				response.send(html);
				break;
			default:
				response.json(json);
				break;
		}
	})
	.catch((error) => {
		console.error(error);
		response.sendStatus(error);
		//response.send(error);
	});
};

browserOpen()
.then(browserContext)
.then(pageOpen)
.then(pageEvent)
.then((page) => {
	const deviceType = [TYPE_MOBILE, TYPE_PC];
	const dataType = [TYPE_JSON, TYPE_TEXT, TYPE_HTML];
	const handler = (request, response) => route(page, request, response);
	app.get(`/proxy/:deviceType(${[...deviceType].join('|')})/:dataType(${[...dataType].join('|')})/*`, handler);
	app.get(`/proxy/:everyType(${[...deviceType, ...dataType, 'header'].join('|')})/*`, handler);
	app.get('/proxy/*', handler);
});

// server listen
//app.use(cors()); // CORS 미들웨어 추가
app.listen(PORT, () => {
	console.log('CORS Proxy Server', PORT);
});

