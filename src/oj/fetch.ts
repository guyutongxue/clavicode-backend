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
import { OjCommitRequest, OjCommitResponse, OjGetProblemResponse, OjGetSolutionResponse, OjListProblemSetsResponse, OjListProblemsResponse } from '../api';

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
      // console.log('cookie is null');
      return false;
    } else {
      // console.log('success get cookie,cookie is ', cookie);
      saveCookie(cookie);
      return true;
    }
  });
}


export async function getCourseName(): Promise<string | null> {
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

export async function listProblemSets() :Promise<OjListProblemSetsResponse>{
  const id = testCourseId;
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
      const list = $("ul.homework");
      return {
        success: true,
        title: title.text().trim(),
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
        // console.log("Cookie not set or expired, try login...");
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
    // response.buffer is deprecated in node-fetch v3. Though we are using v2 now,
    // but keep it for compatibility.
    const buf = Buffer.from(await r.clone().arrayBuffer());
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
      }).then(r => r.arrayBuffer()).then(buf => Buffer.from(buf));
    } else {
      return r.arrayBuffer().then(buf => Buffer.from(buf));
    }
  });
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

export async function listProblems(setId: string): Promise<OjListProblemsResponse> {
  const courseId = testCourseId;
  const page = `https://programming.pku.edu.cn/programming/course/${courseId}/showProblemList.do?problemsId=${setId}&type=json`;
  return tryFetch(page, {
    headers
  }).then(text => {
    if (text === null) {
      return {
        success: false,
        reason: "获取题目列表失败，请检查是否拥有访问该课程的权限。"
      };
    }
    const json = JSON.parse(text);

    if (!("problemlist" in json)) {
      return {
        success: false,
        reason: "获取题目列表失败，请检查是否拥有访问该课程的权限。"
      };
    }
    const problems = (json.problemlist.problems as Record<string, unknown>[]).map((p) => ({
      problemId: p.id as string,
      title: p.title as string,
      status: (p.result !== null ? p.result === "AC" ? 'accepted' : 'tried' : 'none') as ('none' | 'accepted' | 'tried')
    }));
    return {
      success: true,
      title: "",
      problems: problems
    };

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

export async function getDescription(problemId: string, setId: string) : Promise<OjGetProblemResponse> {
  const page = `https://programming.pku.edu.cn/programming/problem/${problemId}/show.do?problemsId=${setId}`;
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
    success: true as const,
    title: $("#problemTitle").text(),
    description: $("#problemDescription").html() ?? "",
    aboutInput: $("#aboutInput").html() ?? "",
    aboutOutput: $("#aboutOutput").html() ?? "",
    sampleInput: input,
    sampleOutput: output,
    hint: $("#problemHint").html() ?? "",
  };
  return r;
}

export async function submitCode(req: OjCommitRequest): Promise<OjCommitResponse> {
  const HEADER_COMMENT = "// Submitted by clavicode\n\n";
  const page = `https://programming.pku.edu.cn/programming/problem/submit.do`;
  const data = new URLSearchParams();
  data.append('problemId', req.problemId);
  data.append('problemsId', req.problemSetId);
  data.append('sourceCode', HEADER_COMMENT + req.code);
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
    return {
      success: false,
      reason: "提交失败，请检查是否拥有访问该课程的权限。"
    };
  }
  if (r.status !== 200) {
    return {
      success: false,
      reason: "提交失败，可能是编程网格服务器出现问题，请稍后再试。"
    };
  }
  const text = iconv.decode(Buffer.from(await r?.arrayBuffer()), "gb2312");
  const $ = cheerio.load(text);
  const solutionId = /solutionId=([0-9a-f]{32})/g.exec(r.url)?.[1];
  if (!solutionId) {
    return {
      success: false,
      reason: "编程网格拒绝服务。可能的原因是输入了不允许的字符序列。"
    };
  }
  if ($("td.t").length > 0) {
    const msg = $("td.t").text();
    return {
      success: false,
      reason: msg
    };
  }
  return {
    success: true,
    solutionId: solutionId
  };
}

export async function getSolution(solutionId: string) : Promise<OjGetSolutionResponse> {
  const page = `https://programming.pku.edu.cn/programming/problem/solution.do?solutionId=${solutionId}&type=json`;
  const text = await tryFetch(page, {
    headers
  });
  if (text === null) {
    return {
      success: false,
      reason: 'permission denied'
    };
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      success: false,
      reason: 'permission denied'
    };
  }
  return {
    success: true,
    status: json.solution.result,
    hint: json.solution.hint
  };
}
