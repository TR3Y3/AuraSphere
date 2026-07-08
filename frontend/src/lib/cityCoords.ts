// Approximate coordinates for the curated US_CITIES list — powers the
// auto-miles estimate on load creation. Static and offline-safe (no
// geocoding API); accuracy ~±0.1° which is plenty for a rate-planning
// mileage estimate. Exact routed miles can come later behind a seam.
export const CITY_COORDS: Record<string, [number, number]> = {
  'Birmingham, AL': [33.52, -86.81], 'Huntsville, AL': [34.73, -86.59],
  'Mobile, AL': [30.69, -88.04], 'Montgomery, AL': [32.37, -86.30],
  'Anchorage, AK': [61.22, -149.90],
  'Phoenix, AZ': [33.45, -112.07], 'Tucson, AZ': [32.22, -110.97],
  'Mesa, AZ': [33.42, -111.83], 'Nogales, AZ': [31.34, -110.93], 'Flagstaff, AZ': [35.20, -111.65],
  'Little Rock, AR': [34.75, -92.29], 'Fort Smith, AR': [35.39, -94.40], 'Rogers, AR': [36.33, -94.12],
  'Los Angeles, CA': [34.05, -118.24], 'San Diego, CA': [32.72, -117.16],
  'San Jose, CA': [37.34, -121.89], 'San Francisco, CA': [37.77, -122.42],
  'Fresno, CA': [36.74, -119.79], 'Sacramento, CA': [38.58, -121.49],
  'Long Beach, CA': [33.77, -118.19], 'Oakland, CA': [37.80, -122.27],
  'Bakersfield, CA': [35.37, -119.02], 'Stockton, CA': [37.96, -121.29],
  'Ontario, CA': [34.06, -117.65], 'Riverside, CA': [33.95, -117.40],
  'Fontana, CA': [34.09, -117.44], 'Otay Mesa, CA': [32.56, -116.94],
  'Denver, CO': [39.74, -104.99], 'Colorado Springs, CO': [38.83, -104.82],
  'Aurora, CO': [39.73, -104.83], 'Pueblo, CO': [38.25, -104.61],
  'Bridgeport, CT': [41.19, -73.20], 'New Haven, CT': [41.31, -72.92],
  'Hartford, CT': [41.76, -72.68], 'Stamford, CT': [41.05, -73.54],
  'Wilmington, DE': [39.75, -75.55], 'Dover, DE': [39.16, -75.52],
  'Jacksonville, FL': [30.33, -81.66], 'Miami, FL': [25.76, -80.19],
  'Tampa, FL': [27.95, -82.46], 'Orlando, FL': [28.54, -81.38],
  'St. Petersburg, FL': [27.77, -82.64], 'Fort Lauderdale, FL': [26.12, -80.14],
  'Lakeland, FL': [28.04, -81.95], 'Ocala, FL': [29.19, -82.14],
  'Fort Myers, FL': [26.64, -81.87], 'Pensacola, FL': [30.42, -87.22],
  'Atlanta, GA': [33.75, -84.39], 'Savannah, GA': [32.08, -81.09],
  'Augusta, GA': [33.47, -81.97], 'Columbus, GA': [32.46, -84.99],
  'Macon, GA': [32.84, -83.63], 'Rincon, GA': [32.30, -81.24],
  'Valdosta, GA': [30.83, -83.28], 'Albany, GA': [31.58, -84.16],
  'Dalton, GA': [34.77, -84.97], 'Gainesville, GA': [34.30, -83.82],
  'Honolulu, HI': [21.31, -157.86],
  'Boise, ID': [43.62, -116.20], 'Idaho Falls, ID': [43.49, -112.04], 'Twin Falls, ID': [42.56, -114.46],
  'Chicago, IL': [41.88, -87.63], 'Aurora, IL': [41.76, -88.32],
  'Joliet, IL': [41.53, -88.08], 'Rockford, IL': [42.27, -89.09],
  'Springfield, IL': [39.80, -89.64], 'Elwood, IL': [41.40, -88.11],
  'Peoria, IL': [40.69, -89.59], 'Champaign, IL': [40.12, -88.24],
  'Indianapolis, IN': [39.77, -86.16], 'Fort Wayne, IN': [41.08, -85.14],
  'Evansville, IN': [37.97, -87.57], 'South Bend, IN': [41.68, -86.25],
  'Gary, IN': [41.59, -87.35], 'Jeffersonville, IN': [38.28, -85.74],
  'Plainfield, IN': [39.70, -86.40],
  'Des Moines, IA': [41.59, -93.62], 'Cedar Rapids, IA': [41.98, -91.67],
  'Davenport, IA': [41.52, -90.58], 'Sioux City, IA': [42.50, -96.40],
  'Wichita, KS': [37.69, -97.34], 'Kansas City, KS': [39.11, -94.63],
  'Topeka, KS': [39.05, -95.68], 'Garden City, KS': [37.97, -100.87],
  'Louisville, KY': [38.25, -85.76], 'Lexington, KY': [38.04, -84.50],
  'Bowling Green, KY': [36.99, -86.44], 'Hebron, KY': [39.07, -84.70],
  'New Orleans, LA': [29.95, -90.07], 'Baton Rouge, LA': [30.45, -91.15],
  'Shreveport, LA': [32.53, -93.75], 'Lafayette, LA': [30.22, -92.02],
  'Lake Charles, LA': [30.23, -93.22],
  'Portland, ME': [43.66, -70.26], 'Bangor, ME': [44.80, -68.77],
  'Baltimore, MD': [39.29, -76.61], 'Columbia, MD': [39.20, -76.86], 'Hagerstown, MD': [39.64, -77.72],
  'Boston, MA': [42.36, -71.06], 'Worcester, MA': [42.26, -71.80], 'Springfield, MA': [42.10, -72.59],
  'Detroit, MI': [42.33, -83.05], 'Grand Rapids, MI': [42.96, -85.66],
  'Warren, MI': [42.51, -83.01], 'Lansing, MI': [42.73, -84.56],
  'Flint, MI': [43.01, -83.69], 'Kalamazoo, MI': [42.29, -85.59], 'Saginaw, MI': [43.42, -83.95],
  'Minneapolis, MN': [44.98, -93.27], 'St. Paul, MN': [44.95, -93.09],
  'Rochester, MN': [44.02, -92.47], 'Duluth, MN': [46.79, -92.10],
  'Jackson, MS': [32.30, -90.18], 'Gulfport, MS': [30.37, -89.09],
  'Tupelo, MS': [34.26, -88.70], 'Meridian, MS': [32.36, -88.70],
  'Kansas City, MO': [39.10, -94.58], 'St. Louis, MO': [38.63, -90.20],
  'Springfield, MO': [37.21, -93.29], 'Joplin, MO': [37.08, -94.51], 'Columbia, MO': [38.95, -92.33],
  'Billings, MT': [45.78, -108.50], 'Missoula, MT': [46.87, -113.99], 'Great Falls, MT': [47.51, -111.29],
  'Omaha, NE': [41.26, -95.93], 'Lincoln, NE': [40.81, -96.68],
  'Grand Island, NE': [40.93, -98.34], 'North Platte, NE': [41.12, -100.77],
  'Las Vegas, NV': [36.17, -115.14], 'Reno, NV': [39.53, -119.81], 'Sparks, NV': [39.53, -119.75],
  'Manchester, NH': [42.99, -71.46], 'Nashua, NH': [42.77, -71.47],
  'Newark, NJ': [40.74, -74.17], 'Jersey City, NJ': [40.73, -74.08],
  'Elizabeth, NJ': [40.66, -74.21], 'Edison, NJ': [40.52, -74.41],
  'Secaucus, NJ': [40.79, -74.06], 'Carteret, NJ': [40.58, -74.23], 'Trenton, NJ': [40.22, -74.74],
  'Albuquerque, NM': [35.08, -106.65], 'Las Cruces, NM': [32.32, -106.76], 'Santa Fe, NM': [35.69, -105.94],
  'New York, NY': [40.71, -74.01], 'Buffalo, NY': [42.89, -78.88],
  'Rochester, NY': [43.16, -77.61], 'Syracuse, NY': [43.05, -76.15],
  'Albany, NY': [42.65, -73.75], 'Yonkers, NY': [40.93, -73.90], 'Binghamton, NY': [42.10, -75.92],
  'Charlotte, NC': [35.23, -80.84], 'Raleigh, NC': [35.78, -78.64],
  'Greensboro, NC': [36.07, -79.79], 'Durham, NC': [35.99, -78.90],
  'Winston-Salem, NC': [36.10, -80.24], 'Wilmington, NC': [34.23, -77.94],
  'Fayetteville, NC': [35.05, -78.88], 'Hickory, NC': [35.73, -81.34],
  'Fargo, ND': [46.88, -96.79], 'Bismarck, ND': [46.81, -100.78], 'Grand Forks, ND': [47.93, -97.03],
  'Columbus, OH': [39.96, -83.00], 'Cleveland, OH': [41.50, -81.69],
  'Cincinnati, OH': [39.10, -84.51], 'Toledo, OH': [41.65, -83.54],
  'Akron, OH': [41.08, -81.52], 'Dayton, OH': [39.76, -84.19],
  'Youngstown, OH': [41.10, -80.65], 'Obetz, OH': [39.88, -82.95],
  'Oklahoma City, OK': [35.47, -97.52], 'Tulsa, OK': [36.15, -95.99], 'Ardmore, OK': [34.17, -97.14],
  'Portland, OR': [45.51, -122.68], 'Salem, OR': [44.94, -123.04],
  'Eugene, OR': [44.05, -123.09], 'Medford, OR': [42.33, -122.87],
  'Philadelphia, PA': [39.95, -75.17], 'Pittsburgh, PA': [40.44, -80.00],
  'Allentown, PA': [40.61, -75.49], 'Erie, PA': [42.13, -80.09],
  'Harrisburg, PA': [40.27, -76.88], 'Scranton, PA': [41.41, -75.66],
  'Carlisle, PA': [40.20, -77.19], 'Bethlehem, PA': [40.63, -75.37],
  'Providence, RI': [41.82, -71.41],
  'Charleston, SC': [32.78, -79.93], 'Columbia, SC': [34.00, -81.03],
  'Greenville, SC': [34.85, -82.40], 'Spartanburg, SC': [34.95, -81.93], 'Greer, SC': [34.94, -82.23],
  'Sioux Falls, SD': [43.55, -96.73], 'Rapid City, SD': [44.08, -103.23],
  'Nashville, TN': [36.16, -86.78], 'Memphis, TN': [35.15, -90.05],
  'Knoxville, TN': [35.96, -83.92], 'Chattanooga, TN': [35.05, -85.31],
  'Jackson, TN': [35.61, -88.81], 'Lebanon, TN': [36.21, -86.29], 'La Vergne, TN': [36.02, -86.58],
  'Houston, TX': [29.76, -95.37], 'San Antonio, TX': [29.42, -98.49],
  'Dallas, TX': [32.78, -96.80], 'Austin, TX': [30.27, -97.74],
  'Fort Worth, TX': [32.76, -97.33], 'El Paso, TX': [31.76, -106.49],
  'Laredo, TX': [27.51, -99.51], 'Corpus Christi, TX': [27.80, -97.40],
  'Lubbock, TX': [33.58, -101.86], 'Amarillo, TX': [35.19, -101.85],
  'McAllen, TX': [26.20, -98.23], 'Brownsville, TX': [25.90, -97.50],
  'Waco, TX': [31.55, -97.15], 'Tyler, TX': [32.35, -95.30], 'Odessa, TX': [31.85, -102.37],
  'Salt Lake City, UT': [40.76, -111.89], 'Ogden, UT': [41.22, -111.97],
  'Provo, UT': [40.23, -111.66], 'St. George, UT': [37.10, -113.58],
  'Burlington, VT': [44.48, -73.21],
  'Virginia Beach, VA': [36.85, -75.98], 'Norfolk, VA': [36.85, -76.29],
  'Richmond, VA': [37.54, -77.44], 'Chesapeake, VA': [36.77, -76.29],
  'Roanoke, VA': [37.27, -79.94], 'Front Royal, VA': [38.92, -78.19], 'Suffolk, VA': [36.73, -76.58],
  'Seattle, WA': [47.61, -122.33], 'Spokane, WA': [47.66, -117.43],
  'Tacoma, WA': [47.25, -122.44], 'Kent, WA': [47.38, -122.23],
  'Vancouver, WA': [45.64, -122.66], 'Sumner, WA': [47.20, -122.24],
  'Charleston, WV': [38.35, -81.63], 'Huntington, WV': [38.42, -82.45], 'Martinsburg, WV': [39.46, -77.96],
  'Milwaukee, WI': [43.04, -87.91], 'Madison, WI': [43.07, -89.40],
  'Green Bay, WI': [44.51, -88.02], 'Kenosha, WI': [42.58, -87.82], 'Appleton, WI': [44.26, -88.42],
  'Cheyenne, WY': [41.14, -104.82], 'Casper, WY': [42.87, -106.31],
}

const R_MILES = 3958.8
// Straight-line → road miles. 1.18 is the standard planning factor for US
// interstate lanes; estimates typically land within ~5–8% of routed miles.
const ROAD_FACTOR = 1.18

function haversine(a: [number, number], b: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R_MILES * Math.asin(Math.sqrt(h))
}

/** Estimated road miles between two "City, ST" pairs from the curated list;
 * null when either city isn't in it (free-typed cities stay manual). */
export function estimateMiles(
  originCity: string | null | undefined, originState: string | null | undefined,
  destCity: string | null | undefined, destState: string | null | undefined,
): number | null {
  if (!originCity || !originState || !destCity || !destState) return null
  const o = CITY_COORDS[`${originCity}, ${originState.toUpperCase()}`]
  const d = CITY_COORDS[`${destCity}, ${destState.toUpperCase()}`]
  if (!o || !d) return null
  return Math.round(haversine(o, d) * ROAD_FACTOR)
}
