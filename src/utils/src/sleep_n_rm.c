/**
 * Copyright (C) 2021 Clavicode Team
 *
 * This file is part of clavicode-backend.
 *
 * clavicode-backend is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * clavicode-backend is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with clavicode-backend.  If not, see <http://www.gnu.org/licenses/>.
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char** argv) {
  if (argc <= 3) {
    fprintf(stderr, "Usage: %s <seconds> <files...>\n", argv[0]);
    return EXIT_FAILURE;
  }
  sleep(atoi(argv[1]));
  for (int i = 2; i < argc; i++) {
    unlink(argv[i]);
  }
  return EXIT_SUCCESS;
}
