// Copyright (C) 2021 Clavicode Team
// 
// This file is part of clavicode-backend.
// 
// clavicode-backend is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// clavicode-backend is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with clavicode-backend.  If not, see <http://www.gnu.org/licenses/>.

import { default as fetch, HeadersInit, RequestInit, Response } from 'node-fetch';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import * as mime from 'mime/lite';
import { URL, URLSearchParams } from 'url';
import { OjSubmitRequest, OjSubmitResponse, OjGetProblemResponse, OjGetSolutionResponse, OjListProblemSetsResponse, OjListProblemsResponse } from '../api';

const testUserName = 'clavicode.test.user';
const testUserPassword = 'clavicode';
const testCourseId = '6c45504288b542eca6d96bfe4dc22b4a';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let _cookie: Record<string, string> = {
  "PG_client": "clavicode; Max-Age=315360000; Expires=Fri, 05-Dec-2031 05:34:07 GMT; Path=/; Secure"
};
function saveCookie(cookie: string[]) {
  for (const c of cookie) {
    const [key, ...value] = c.split('=');
    _cookie[key] = value.join('');
  }
}
function loadCookie(): { cookie?: string } {
  const cookie = Object.entries(_cookie).map(([k, v]) => `${k}=${v}`).join('; ');
  return {
    cookie
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
  data.append('type', 'json');
  console.log("LOGG");
  return fetch("https://programming.pku.edu.cn/login.do", {
    method: "POST",
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...loadCookie()
    },
    redirect: 'manual',
    body: data.toString()
  }).then(r => {
    const cookie = r.headers.get('Set-Cookie');
    if (cookie === null) {
      // console.log('cookie is null');
      return false;
    } else {
      // console.log('success get cookie,cookie is ', cookie);
      saveCookie(cookie.split(', '));
      return true;
    }
  });
}


export async function getCourseName(): Promise<string | null> {
  const id = testCourseId;
  if (id === null) return null;
  const page = `https://programming.pku.edu.cn/course/${id}/?type=json`;
  return tryFetch(page, {
    headers
  })
    .then(r => {
      if (r === null) return null;
      const json = JSON.parse(r);
      return json.course.title;
    });
}

export async function listProblemSets(): Promise<OjListProblemSetsResponse> {
  const id = testCourseId;
  const page = `https://programming.pku.edu.cn/course/${id}/?type=json`;
  return tryFetch(page, {
    headers
  })
    .then(r => {
      if (r === null) return { success: false, reason: "" };
      const json = JSON.parse(r);
      const title = json.course.title;
      const sets: any[] = json.course.problemlists;
      return {
        success: true,
        title: title,
        problemSets: sets.map(set => {
          const openDate = new Date(set.assignment.openTime);
          const closeDate = new Date(set.assignment.closeTime);
          const now = new Date();
          const isAvailable = now >= openDate && now <= closeDate;
          return {
            problemSetId: set.id,
            title: set.title,
            status: isAvailable ? 'ok' : 'closed'
          };
        })
      };
    });
}

async function tryFetch(url: string, options: RequestInit): Promise<string | null> {
  function getOptions(): RequestInit {
    return {
      ...options,
      redirect: 'manual',
      headers: {
        ...options.headers,
        ...loadCookie(),
      }
    };
  }
  let _tried = 0;
  async function retry() {
    console.log("TRYING", url, _tried);
    switch (_tried++) {
      case 1:
        console.log("Cookie not set or expired, try login...");
        await login();
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
      console.log(json);
      if (json.status !== 'OK') {
        continue;
      }
      return text;
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
      }).then(r => r.arrayBuffer()).then(buf => Buffer.from(buf));
    } else {
      return r.arrayBuffer().then(buf => Buffer.from(buf));
    }
  });
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

export async function listProblems(setId: string): Promise<OjListProblemsResponse> {
  const courseId = testCourseId;
  const page = `https://programming.pku.edu.cn/probset/${setId}/?type=json`;
  return tryFetch(page, {
    headers
  }).then(async (text) => {
    if (text === null) {
      return {
        success: false,
        reason: "获取题目列表失败，请检查是否拥有访问该课程的权限。"
      };
    }
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        reason: "获取题目列表失败，请检查是否拥有访问该课程的权限。"
      };
    }

    if (!("problemlist" in json)) {
      return {
        success: false,
        reason: "获取题目列表失败，请检查是否拥有访问该课程的权限。"
      };
    }
    const data = new URLSearchParams();
    data.append('query', 'results');
    data.append('username', testUserName);
    data.append('probsetId', setId);
    const results = await tryFetch(`https://programming.pku.edu.cn/account/query.do`, {
      method: "POST",
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data.toString(),
    });
    const status: Record<string, string> = {};
    if (results !== null) {
      const json = JSON.parse(results);
      if (json.status === 'OK') {
        for (const r of json.results) {
          status[r.id] = (r.result as string).toLowerCase();
        }
      }
    }

    return {
      success: true,
      title: "",
      problems: (json.problemlist.problems as any[]).map((p, i) => ({
        title: p.title,
        problemId: p.id,
        status: "none"
      }))
    };

  });
}


export interface SolutionDescription {
  status: string;
  details: string;
}

export async function getProblem(problemId: string, setId: string): Promise<OjGetProblemResponse> {
  const page = `https://programming.pku.edu.cn/probset/${setId}/${problemId}/?type=json`;
  const text = await tryFetch(page, {
    headers
  });
  if (text === null) return {
    success: false,
    reason: '??'
  };
  const json = JSON.parse(text);
  for (const i in json.problem) {
    const html = json.problem[i];
    const $ = cheerio.load(html);
    const promises: Promise<void>[] = [];
    $("img").each(function (_) {
      const src = $(this).attr("src");
      if (typeof src === "undefined") return;
      promises.push(getImage((new URL(src, page)).href).then(base64 => {
        $(this).attr("src", base64);
      }));
    });
    await Promise.all(promises);
    json.problem[i] = $('body').html();
  }
  function getRawIo(text: string) {
    if (typeof text === "undefined") return "";
    return text.replace(/\r/, '').replace(/\u2003|\u200b|\u00a0|&nbsp;/g, ' ');
  }
  function text2html(text?: string) {
    if (typeof text === "undefined") return "";
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/<br>/g, "\n");
    text = text.replace(/<br\/>/g, "\n");
    text = text.replace(/\s+\n/g, "\n");
    text = text.replace(/\n+/g, "<br>");
    text = text.replace(/\s{2}/g, "&nbsp;&nbsp;");
    return text;
  }
  return {
    success: true,
    title: json.problem.title,
    description: text2html(json.problem.description),
    aboutInput: text2html(json.problem.aboutInput),
    aboutOutput: text2html(json.problem.aboutOutput),
    hint: text2html(json.problem.hint),
    sampleInput: getRawIo(json.problem.sampleInput),
    sampleOutput: getRawIo(json.problem.sampleOutput)
  };
}

export async function submitCode(req: OjSubmitRequest): Promise<OjSubmitResponse> {
  const HEADER_COMMENT = "// Submitted by Clavicode";
  const page = `https://programming.pku.edu.cn/probset/${req.problemSetId}/${req.problemId}/submit.do`;
  const data = new URLSearchParams();
  data.append('sourceCode', HEADER_COMMENT + req.code);
  data.append('programLanguage', 'C++');
  data.append('type', 'json');
  return tryFetch(page, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: data.toString()
  }).then(async (r) => {
    if (r === null) return { success: false, reason: "empty res" };
    let json: any;
    try {
      json = JSON.parse(r);
    } catch {
      return { success: false, reason: "json decode" };
    }
    if (!json.solution) return { success: false, reason: "no solution" };
    return {
      success: true,
      solutionId: json.solution.id as string
    };
  });
}

export async function getSolution(solutionId: string): Promise<OjGetSolutionResponse> {
  const page = `https://programming.pku.edu.cn/solution/${solutionId}/status.do`;
  const r = await tryFetch(page, {
    headers
  });
  if (r === null) return { success: false, reason: "null" };
  const json = JSON.parse(r);
  if (!json.solution) return { success: false, reason: "no solution" };
  return {
    success: true,
    status: json.solution.result,
    hint: json.solution.result === 'Processing' ? '处理中，请稍候' : json.solution.hint
  };
}
