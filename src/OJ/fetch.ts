import { default as fetch, HeadersInit, RequestInit, Response } from 'node-fetch';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import * as mime from 'mime/lite';
import { URL, URLSearchParams } from 'url';
import { OjListProblemSetsResponse } from '../api';

interface IProblemInfo {
  id: string;
  setId: string;
  text: string;
  index: number;
  status?: 'ac' | 'wa';
}
interface IProblemSetInfo extends IProblemInfo {
  id: string;
  text: string;
  available: boolean;
}

const testUserName = 'clavicode.test.user';
const testUserPassword = 'clavicode';
const testCourseId = '6c45504288b542eca6d96bfe4dc22b4a';
let _cookie: string | null = null;
function saveCookie(cookie: string | null) {
  _cookie = cookie;
}
function loadCookie(): { cookie?: string } {
  if (_cookie === null) return {};
  return {
    cookie: _cookie,
  };
}
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73";
const acceptLanguage = "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6";
const headers: HeadersInit = {
  'User-Agent': userAgent,
  'Accept-Language': acceptLanguage
};

export async function login(): Promise<boolean> {
  const username = testUserName;
  const password = testUserPassword;
  const data = new URLSearchParams();
  data.append('username', username);
  data.append('password', password);
  return fetch("https://programming.pku.edu.cn/programming/login.do", {
    method: "POST",
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'manual',
    body: data.toString() + "&login=%B5%C7%C2%BC" // 登录 in GB2312
  }).then(r => {
    const cookie = r.headers.get('Set-Cookie');
    if (cookie === null) {
      console.log('cookie is null');
      return false;
    } else {
      console.log('success get cookie,cookie is ', cookie);
      saveCookie(cookie);
      return true;
    }
  });
}


export async function getCourseName() {
  const id = testCourseId;
  if (id === null) return null;
  const page = `https://programming.pku.edu.cn/programming/course/${id}/show.do`;
  return fetch(page, {
    headers
  })
    .then(r => r.buffer())
    .then(buf => {
      const text = iconv.decode(buf, 'gb2312');
      const $ = cheerio.load(text);
      const title = $(".showtitle");
      title.children().remove();
      return title.text().trim();
    });
}

export async function getProblemSets() :Promise<OjListProblemSetsResponse>{
  const id = testCourseId;
  const page = `https://programming.pku.edu.cn/programming/course/${id}/show.do`;
  return fetch(page, {
    headers
  })
    .then(r => r.buffer())
    .then(buf => {
      const text = iconv.decode(buf, 'gb2312');
      const $ = cheerio.load(text);
      const list = $("ul.homework");
      return {
        success: true,
        title: testCourseId,
        problemSets: list.children().map(function () {
          const a = $(this).children("a");
          const color = $(this).children("font").attr("color");
          const href = a.attr("href");
          const text = a.text();
          if (typeof href === "undefined") return null;
          const result = /problemsId=([0-9a-f]{32})/.exec(href);
          if (result === null) return null;
          const pId = result[1];
          return {
            problemSetId: pId,
            title: text,
            status: <'ok' | 'closed'>(color === "red" ? 'ok' : 'closed')
          };
        }).toArray()
      };
    });
}

async function tryFetch(url: string, options: RequestInit): Promise<string | null>;
async function tryFetch(url: string, options: RequestInit, decode: true): Promise<string | null>;
async function tryFetch(url: string, options: RequestInit, decode: false): Promise<Response | null>;
async function tryFetch(url: string, options: RequestInit, decode = true): Promise<Response | string | null> {
  function getOptions(): RequestInit {
    return {
      ...options,
      headers: {
        ...options.headers,
        ...loadCookie(),
      }
    };
  }
  let _tried = 0;
  async function retry() {
    switch (_tried++) {
      case 1:
        console.log("Cookie not set or expired, try login...");
        await login();
        return false;
      case 0:
        return false;
      default:
        return true;
    }
  }
  while (true) {
    if (await retry()) break;
    const r = await fetch(url, getOptions());
    if (r.status === 404) {
      continue;
    }
    const buf = await r.clone().buffer();
    if (r.headers.get('Content-Type')?.includes('application/json')) {
      const text = iconv.decode(buf, 'utf-8');
      const json = JSON.parse(text);
      if (json?.type === 'relogin') {
        continue;
      }
      return decode ? text : r;
    } else {
      const text = iconv.decode(buf, 'gb2312');
      const $ = cheerio.load(text);
      if ($('[name="accessDeny"]').length > 0) {
        continue;
      }
      return decode ? text : r;
    }
  }
  return null;
}

/** Translate image url to base64 */
async function getImage(url: string): Promise<string> {
  let mimeType;
  const buf = await fetch(url, {
    headers: {
      ...headers,
      ...loadCookie(),
    }
  }).then(async r => {
    mimeType = r.headers.get('Content-Type') ?? mime.getType(url);
    if (mimeType?.startsWith("text/html")) {
      if (!(await login())) return Buffer.from("");
      return fetch(url, {
        headers: {
          ...headers,
          ...loadCookie()
        }
      }).then(r => r.buffer());
    } else {
      return r.buffer();
    }
  });
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

export async function getProblems(setId: string) {
  const courseId = testCourseId;
  const page = `https://programming.pku.edu.cn/programming/course/${courseId}/showProblemList.do?problemsId=${setId}&type=json`;
  return tryFetch(page, {
    headers
  }).then(text => {
    if (text === null) {
      console.log("获取题目列表失败，请检查是否拥有访问该课程的权限。");
      return [];
    }
    const json = JSON.parse(text);

    console.log(json);
    if (!("problemlist" in json)) {
      console.log("获取题目列表失败，请检查是否拥有访问该课程的权限。");
      return [];
    }
    return (json.problemlist.problems as any[]).map((p, i) => (<IProblemInfo>{
      id: p.id,
      setId: setId,
      index: i + 1,
      text: p.title,
      status: p.result === null ? undefined : (p.result === "AC" ? 'ac' : 'wa')
    }));

  });
}

export interface ProblemDescription {
  title: string;
  description: string;
  aboutInput: string;
  aboutOutput: string;
  hint: string;
  input: string;
  output: string;
}

export interface SolutionDescription {
  status: string;
  details: string;
}

export async function getDescription(info: IProblemInfo) {
  const page = `https://programming.pku.edu.cn/programming/problem/${info.id}/show.do?problemsId=${info.setId}`;
  const text = await tryFetch(page, {
    headers
  });
  if (text === null) {
    return {
      success: false,
      reason: 'hahaha'
    };
  }
  const $ = cheerio.load(text);
  const promises: Promise<void>[] = [];
  $("#problemDescription,#aboutinput,#aboutOutput,#problemHint").find("img").each(function () {
    const src = $(this).attr("src");
    if (typeof src === "undefined") return;
    promises.push(getImage((new URL(src, page)).href).then(base64 => {
      $(this).attr("src", base64);
    }));
  });

  await Promise.all(promises);

  function getRawIo(selector: string) {
    let text = $(selector).text();
    const html = $(selector).html();
    if (!text.includes('\n') && html?.includes('<br>')) {
      text = html.replace(/<br>/g, '\n');
    }
    return text.replace(/\u2003|\u200b|\u00a0|&nbsp;/g, ' ');
  }
  const input = getRawIo('#sampleInput');
  const output = getRawIo('#sampleOutput');

  const r = {
    success: true,
    title: $("#problemTitle").text(),
    description: $("#problemDescription").html() ?? "",
    aboutInput: $("#aboutInput").html() ?? "",
    aboutOutput: $("#aboutOutput").html() ?? "",
    sampleInput: input,
    sampleOutput: output,
    hint: $("#problemHint").html() ?? "",
  };
  console.log(r);
  return r;
}

export async function submitCode(info: IProblemInfo, code: string) {
  const HEADER_COMMENT = "// Submitted by 'Programming Grid' clavicode\n\n";
  const page = `https://programming.pku.edu.cn/programming/problem/submit.do`;
  const data = new URLSearchParams();
  data.append('problemId', info.id);
  data.append('problemsId', info.setId);
  data.append('sourceCode', HEADER_COMMENT + code);
  data.append('programLanguage', 'C++');
  const r = await tryFetch(page, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: data.toString()
  }, false);
  if (r === null) {
    console.log("提交失败，请检查是否拥有访问该课程的权限。");
    return null;
  }
  if (r.status !== 200) {
    console.log("提交失败。可能是编程网格服务器出现问题，请稍后再试。");
    return null;
  }
  const text = iconv.decode(await r?.buffer(), "gb2312");
  const $ = cheerio.load(text);
  if (!r.url.includes("solutionId")) {
    console.log("编程网格拒绝服务。可能的原因是输入了不允许的字符序列。");
    return {
      success: false,
      reason: "编程网格拒绝服务。可能的原因是输入了不允许的字符序列。"
    };
  }
  if ($("td.t").length > 0) {
    const msg = $("td.t").text();
    console.log(msg);
    return {
      success: false,
      reason: msg
    };
  }
  const status = $('.showtitle').text().trim();
  const values = $('.fieldvalue');
  if (values.length !== 3) return null;
  const details = values.eq(1).children().html();
  return {
    success: true,
    status: status,
    hint: details ?? "",
    time: 0,
    memory: ""
  };
}
