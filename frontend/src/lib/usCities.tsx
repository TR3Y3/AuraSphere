// Curated "City, ST" list for autocomplete — major metros, freight hubs, and
// port/distribution cities, all 48 continental states + AK/HI. Static and
// shipped with the bundle: no API, no key, works on locked-down networks.
// Free text is still allowed everywhere — this only accelerates entry.
export const US_CITIES: string[] = [
  'Birmingham, AL', 'Huntsville, AL', 'Mobile, AL', 'Montgomery, AL',
  'Anchorage, AK',
  'Phoenix, AZ', 'Tucson, AZ', 'Mesa, AZ', 'Nogales, AZ', 'Flagstaff, AZ',
  'Little Rock, AR', 'Fort Smith, AR', 'Rogers, AR',
  'Los Angeles, CA', 'San Diego, CA', 'San Jose, CA', 'San Francisco, CA', 'Fresno, CA',
  'Sacramento, CA', 'Long Beach, CA', 'Oakland, CA', 'Bakersfield, CA', 'Stockton, CA',
  'Ontario, CA', 'Riverside, CA', 'Fontana, CA', 'Otay Mesa, CA',
  'Denver, CO', 'Colorado Springs, CO', 'Aurora, CO', 'Pueblo, CO',
  'Bridgeport, CT', 'New Haven, CT', 'Hartford, CT', 'Stamford, CT',
  'Wilmington, DE', 'Dover, DE',
  'Jacksonville, FL', 'Miami, FL', 'Tampa, FL', 'Orlando, FL', 'St. Petersburg, FL',
  'Fort Lauderdale, FL', 'Lakeland, FL', 'Ocala, FL', 'Fort Myers, FL', 'Pensacola, FL',
  'Atlanta, GA', 'Savannah, GA', 'Augusta, GA', 'Columbus, GA', 'Macon, GA',
  'Rincon, GA', 'Valdosta, GA', 'Albany, GA', 'Dalton, GA', 'Gainesville, GA',
  'Honolulu, HI',
  'Boise, ID', 'Idaho Falls, ID', 'Twin Falls, ID',
  'Chicago, IL', 'Aurora, IL', 'Joliet, IL', 'Rockford, IL', 'Springfield, IL',
  'Elwood, IL', 'Peoria, IL', 'Champaign, IL',
  'Indianapolis, IN', 'Fort Wayne, IN', 'Evansville, IN', 'South Bend, IN', 'Gary, IN',
  'Jeffersonville, IN', 'Plainfield, IN',
  'Des Moines, IA', 'Cedar Rapids, IA', 'Davenport, IA', 'Sioux City, IA',
  'Wichita, KS', 'Kansas City, KS', 'Topeka, KS', 'Garden City, KS',
  'Louisville, KY', 'Lexington, KY', 'Bowling Green, KY', 'Hebron, KY',
  'New Orleans, LA', 'Baton Rouge, LA', 'Shreveport, LA', 'Lafayette, LA', 'Lake Charles, LA',
  'Portland, ME', 'Bangor, ME',
  'Baltimore, MD', 'Columbia, MD', 'Hagerstown, MD',
  'Boston, MA', 'Worcester, MA', 'Springfield, MA',
  'Detroit, MI', 'Grand Rapids, MI', 'Warren, MI', 'Lansing, MI', 'Flint, MI',
  'Kalamazoo, MI', 'Saginaw, MI',
  'Minneapolis, MN', 'St. Paul, MN', 'Rochester, MN', 'Duluth, MN',
  'Jackson, MS', 'Gulfport, MS', 'Tupelo, MS', 'Meridian, MS',
  'Kansas City, MO', 'St. Louis, MO', 'Springfield, MO', 'Joplin, MO', 'Columbia, MO',
  'Billings, MT', 'Missoula, MT', 'Great Falls, MT',
  'Omaha, NE', 'Lincoln, NE', 'Grand Island, NE', 'North Platte, NE',
  'Las Vegas, NV', 'Reno, NV', 'Sparks, NV',
  'Manchester, NH', 'Nashua, NH',
  'Newark, NJ', 'Jersey City, NJ', 'Elizabeth, NJ', 'Edison, NJ', 'Secaucus, NJ',
  'Carteret, NJ', 'Trenton, NJ',
  'Albuquerque, NM', 'Las Cruces, NM', 'Santa Fe, NM',
  'New York, NY', 'Buffalo, NY', 'Rochester, NY', 'Syracuse, NY', 'Albany, NY',
  'Yonkers, NY', 'Binghamton, NY',
  'Charlotte, NC', 'Raleigh, NC', 'Greensboro, NC', 'Durham, NC', 'Winston-Salem, NC',
  'Wilmington, NC', 'Fayetteville, NC', 'Hickory, NC',
  'Fargo, ND', 'Bismarck, ND', 'Grand Forks, ND',
  'Columbus, OH', 'Cleveland, OH', 'Cincinnati, OH', 'Toledo, OH', 'Akron, OH',
  'Dayton, OH', 'Youngstown, OH', 'Obetz, OH',
  'Oklahoma City, OK', 'Tulsa, OK', 'Ardmore, OK',
  'Portland, OR', 'Salem, OR', 'Eugene, OR', 'Medford, OR',
  'Philadelphia, PA', 'Pittsburgh, PA', 'Allentown, PA', 'Erie, PA', 'Harrisburg, PA',
  'Scranton, PA', 'Carlisle, PA', 'Bethlehem, PA',
  'Providence, RI',
  'Charleston, SC', 'Columbia, SC', 'Greenville, SC', 'Spartanburg, SC', 'Greer, SC',
  'Sioux Falls, SD', 'Rapid City, SD',
  'Nashville, TN', 'Memphis, TN', 'Knoxville, TN', 'Chattanooga, TN', 'Jackson, TN',
  'Lebanon, TN', 'La Vergne, TN',
  'Houston, TX', 'San Antonio, TX', 'Dallas, TX', 'Austin, TX', 'Fort Worth, TX',
  'El Paso, TX', 'Laredo, TX', 'Corpus Christi, TX', 'Lubbock, TX', 'Amarillo, TX',
  'McAllen, TX', 'Brownsville, TX', 'Waco, TX', 'Tyler, TX', 'Odessa, TX',
  'Salt Lake City, UT', 'Ogden, UT', 'Provo, UT', 'St. George, UT',
  'Burlington, VT',
  'Virginia Beach, VA', 'Norfolk, VA', 'Richmond, VA', 'Chesapeake, VA', 'Roanoke, VA',
  'Front Royal, VA', 'Suffolk, VA',
  'Seattle, WA', 'Spokane, WA', 'Tacoma, WA', 'Kent, WA', 'Vancouver, WA', 'Sumner, WA',
  'Charleston, WV', 'Huntington, WV', 'Martinsburg, WV',
  'Milwaukee, WI', 'Madison, WI', 'Green Bay, WI', 'Kenosha, WI', 'Appleton, WI',
  'Cheyenne, WY', 'Casper, WY',
]

/** Parse "City, ST" → { city, state } (state uppercased); null if not that shape. */
export function splitCityState(value: string): { city: string; state: string } | null {
  const m = value.match(/^(.+),\s*([A-Za-z]{2})$/)
  if (!m) return null
  return { city: m[1].trim(), state: m[2].toUpperCase() }
}

/** Render once per page that uses city autocomplete inputs. */
export function CityDatalist() {
  return (
    <datalist id="us-cities">
      {US_CITIES.map((c) => <option key={c} value={c} />)}
    </datalist>
  )
}
