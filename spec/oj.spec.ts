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


import { getProblem, getSolution, listProblems, listProblemSets, submitCode } from '../src/oj/fetch';

describe("Programming Grid fetching", () => {

  const SET_ID = '8c901cbb883a408da938fefa2c14f083';
  const PROBLEM_ID = 'f69c9dec2a1543c18a63f7dacec1e439';

  const SOLUTION_CODE = `#include <iostream>
#include <algorithm>

int main() {
    int triangle[100][100], ans[100][100], N;
    std::cin >> N;
    for (int i = 0; i < N; i++) {
        for (int j = 0; j <= i; j++) {
            std::cin >> triangle[i][j];
        }
    }
    for (int i = 0; i < N; i++) {
        ans[N - 1][i] = triangle[N - 1][i];
    }
    for (int i = N - 2; i >= 0; i--) {
        for (int j = 0; j <= i; j++) {
            ans[i][j] = triangle[i][j] + std::max(ans[i + 1][j], ans[i + 1][j + 1]);
        }
    }
    std::cout << ans[0][0];
}`;

  it("should get problem sets", async () => {
    const problemSets = await listProblemSets();
    expect(problemSets.success).toBeTrue();
  });

  it("should get problem list in a set", async () => {
    const problems = await listProblems(SET_ID);
    expect(problems.success).toBeTrue();
  });

  it("should get problem discription", async () => {
    const description = await getProblem(PROBLEM_ID, SET_ID);
    expect(description.success).toBeTrue();
  });

  it("should submit", async () => {
    const submit = await submitCode({
      problemId: PROBLEM_ID, 
      problemSetId: SET_ID, 
      code: SOLUTION_CODE
    });
    expect(submit.success).toBeTrue();

    if (!submit.success) return;

    const solution = await getSolution(submit.solutionId);
    expect(solution.success).toBeTrue();
  });
});
