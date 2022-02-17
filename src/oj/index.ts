// Copyright (C) 2022 Clavicode Team
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

import type { Application } from 'express';
import type { OjSubmitRequest, OjSubmitResponse } from '../api';
import { authenticateToken, setCourse } from '../user_system';
import { getProblem, getSolution, listProblems, listProblemSets, submitCode } from './fetch';

export function handleOj(app: Application) {


  app.get('/oj/listProblemSets', async (req, res) => {
    const response = await listProblemSets();
    console.log(response);
    res.json(response);
  });

  app.get('/oj/listProblems/:problemSetId', async (req, res) => {
    const { problemSetId } = req.params;
    if (!problemSetId) {
      res.json({
        success: false,
        reason: 'no problem set id'
      });
    }
    const response = await listProblems(problemSetId);
    res.json(response);
  });

  app.get('/oj/getProblem/:problemSetId/:problemId', async (req, res) => {
    const { problemSetId, problemId } = req.params;
    if (!problemSetId || !problemId) {
      res.json({
        success: false,
        reason: 'no problem set id or problem id'
      });
    }
    const response = await getProblem(problemId, problemSetId);
    res.json(response);
  });

  app.post('/oj/submit', async (req, res) => {
    try {
      const request: OjSubmitRequest = req.body;
      const response = await submitCode(request);
      res.json(response);
    } catch {
      res.json(<OjSubmitResponse>{
        success: false,
        reason: 'JSON decode failure'
      });
    }
  });

  app.get('/oj/getSolution/:solutionId', async (req, res) => {
    const { solutionId } = req.params;
    if (!solutionId) {
      res.json({
        success: false,
        reason: 'no solution id'
      });
    }
    const response = await getSolution(solutionId);
    res.json(response);
  });

  app.post('/oj/setCourse', async (req, res) => {
    const email = await authenticateToken(req);
    console.log(email);
    if (email) {
      res.json(await setCourse(email, req.body.OJtype, req.body.courseId));
    }
    else {
      res.json({ success: false, reason: 'bad header' });
    }
  });

}
