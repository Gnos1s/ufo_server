/* Code to compute "Automatic calculated" B1 incrementation

Copyright 2003, 2005, 2006 Jim Fougeron, Paul Zimmermann.
Translated to JavaScript by Gnosis (v2 only).

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 3 of the License, or (at your
option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
more details.

You should have received a copy of the GNU General Public License
along with this program; see the file COPYING.  If not, see
http://www.gnu.org/licenses/ or write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA. */

/* 
 * Version #2 function is the one we are using with a const
 * adjustment of 1.33
 */

/* Here is my "second" attempt at a B1 adjustment function.
 * this version looks pretty good 
 *
 * THIS is the version being used.
 */
module.exports = /*double*/ function calc_B1_AutoIncrement (/*double*/ cur_B1 /*, double incB1val, int calcInc*/) {
  var incB1val = 1.;
  var calcInc = 1.;
  /*const double*/ var const_adj = 1.33;
  /*double*/ var B1Mod;
  if (!calcInc) {
    return cur_B1 + incB1val;  /* incB1val is a constant to add to B1 */
  }

  /* This simple table was "created" based upon the "Optimal B1 table"
     in the README file */
  if (cur_B1 < 2000.) {
    B1Mod = 200.;
  } else if (cur_B1 < 11000.) {  /* 30 curves from B1=2000 to 11000 */
    B1Mod = 300.    * (1. - ((cur_B1 - 2000.) / 9000.));
    B1Mod +=433.334 * (1. - ((11000. - cur_B1) / 9000.));
  } else if (cur_B1 < 50000.) {  /* 90 curves from B1=11000 to 50000 */
    B1Mod = 433.334 * (1. - ((cur_B1 - 11000.) / 39000.));
    B1Mod +=833.334 * (1. - ((50000. - cur_B1) / 39000.));
  } else if (cur_B1 < 250000.) {  /* 240 curves from B1=50000 to 250000 */
    B1Mod = 833.334 * (1. - ((cur_B1 - 50000.) / 200000.));
    B1Mod +=1500.   * (1. - ((250000. - cur_B1) / 200000.));
  } else if (cur_B1 < 1000000.) {  /* 500 curves from B1=250000 to 1e6 */
    B1Mod = 1500.        * (1. - ((cur_B1 - 250000.) / 750000.));
    B1Mod +=1818.18182   * (1. - ((1000000. - cur_B1) / 750000.));
  } else if (cur_B1 < 3000000.) {  /* 1100 curves from B1=1e6 to 3e6 */
    B1Mod = 1818.18182   * (1. - ((cur_B1 - 1000000.) / 2000000.));
    B1Mod +=2758.621     * (1. - ((3000000. - cur_B1) / 2000000.));
  } else if (cur_B1 < 11000000.) {  /* 2900 curves from B1=3e6 to 11e6 */
    B1Mod = 2758.621     * (1. - ((cur_B1 - 3000000.) / 8000000.));
    B1Mod +=5818.18182   * (1. - ((11000000. - cur_B1) / 8000000.));
  } else if (cur_B1 < 43000000.) {  /* 5500 curves from B1=11e6 to 43e6 */
    B1Mod = 5818.18182   * (1. - ((cur_B1 - 11000000.) / 32000000.));
    B1Mod +=7444.44445   * (1. - ((43000000. - cur_B1) / 32000000.));
  } else if (cur_B1 < 110000000.) {  /* 9000 curves from B1=43e6 to 11e7 */
    B1Mod = 7444.44445   * (1. - ((cur_B1 - 43000000.)  / 67000000.));
    B1Mod +=6818.18182   * (1. - ((110000000. - cur_B1) / 67000000.));
  } else if (cur_B1 < 260000000.) {  /* 22000 curves from B1=11e7 to 26e7 */
    B1Mod = 6818.18182   * (1. - ((cur_B1 - 110000000.) / 150000000.));
    B1Mod +=11346.1539   * (1. - ((260000000. - cur_B1) / 150000000.));
  } else if (cur_B1 < 850000000.) {  /* 52000 curves from B1=26e7 to 85e7 */
    B1Mod = 11346.1539   * (1. - ((cur_B1 - 260000000.) / 590000000.));
    B1Mod +=24698.8      * (1. - ((850000000. - cur_B1) / 590000000.));
  } else if (cur_B1 < 2900000000.) {  /* 83000 curves from B1=85e7 to 29e8 */
    B1Mod = 24698.8      * (1. - ((cur_B1 - 850000000.)  / 2050000000.));
    B1Mod +=50000.0      * (1. - ((2900000000. - cur_B1) / 2050000000.));
  } else {
    B1Mod = 50000.;
  }

  return Math.floor (cur_B1 + const_adj*(B1Mod*incB1val) + 0.5);
};
