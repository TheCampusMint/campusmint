import type { UniversityId } from "../universities.ts";

/** Editorial display priorities, with an official schedule for every slot. These are not popularity rankings. */
export const campusSportsCoverage = {
  "tamu": [
    {
      "sport": "football",
      "url": "https://12thman.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://12thman.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "baseball",
      "url": "https://12thman.com/sports/baseball/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://12thman.com/sports/womens-volleyball/schedule/"
    },
    {
      "sport": "equestrian",
      "url": "https://12thman.com/sports/equestrian/schedule/"
    },
    {
      "sport": "golf",
      "url": "https://12thman.com/sports/mens-golf/schedule/"
    },
    {
      "sport": "softball",
      "url": "https://12thman.com/sports/softball/schedule/"
    },
    {
      "sport": "tennis",
      "url": "https://12thman.com/sports/womens-tennis/schedule/"
    }
  ],
  "blinn": [
    {
      "sport": "football",
      "url": "https://buccaneersports.com/sports/football/schedule/"
    },
    {
      "sport": "baseball",
      "url": "https://buccaneersports.com/sports/baseball/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://buccaneersports.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    }
  ],
  "texas": [
    {
      "sport": "football",
      "url": "https://texaslonghorns.com/sports/football/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://texaslonghorns.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    },
    {
      "sport": "basketball",
      "url": "https://texaslonghorns.com/sports/mens-basketball/schedule/"
    }
  ],
  "lsu": [
    {
      "sport": "football",
      "url": "https://lsusports.net/sports/fb/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://lsusports.net/sports/mb/schedule/"
    },
    {
      "sport": "baseball",
      "url": "https://lsusports.net/sports/bsb/schedule/"
    }
  ],
  "alabama": [
    {
      "sport": "football",
      "url": "https://rolltide.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://rolltide.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "baseball",
      "url": "https://rolltide.com/sports/baseball/schedule/"
    }
  ],
  "oregon": [
    {
      "sport": "football",
      "url": "https://goducks.com/sports/football/schedule/"
    },
    {
      "sport": "track",
      "url": "https://goducks.com/sports/track-and-field/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://goducks.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    }
  ],
  "harvard": [
    {
      "sport": "rowing",
      "url": "https://gocrimson.com/sports/mens-heavyweight-rowing/schedule/"
    },
    {
      "sport": "hockey",
      "url": "https://gocrimson.com/sports/mens-ice-hockey/schedule/"
    },
    {
      "sport": "football",
      "url": "https://gocrimson.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://gocrimson.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "lacrosse",
      "url": "https://gocrimson.com/sports/mens-lacrosse/schedule/"
    },
    {
      "sport": "golf",
      "url": "https://gocrimson.com/sports/mens-golf/schedule/"
    }
  ],
  "michigan": [
    {
      "sport": "football",
      "url": "https://mgoblue.com/sports/football/schedule/"
    },
    {
      "sport": "hockey",
      "url": "https://mgoblue.com/sports/mens-ice-hockey/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://mgoblue.com/sports/mens-basketball/schedule/"
    }
  ],
  "miami": [
    {
      "sport": "football",
      "url": "https://miamihurricanes.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://miamihurricanes.com/sports/mbball/schedule/"
    },
    {
      "sport": "baseball",
      "url": "https://miamihurricanes.com/sports/baseball/schedule/"
    }
  ],
  "ucla": [
    {
      "sport": "basketball",
      "url": "https://uclabruins.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "football",
      "url": "https://uclabruins.com/sports/football/schedule/"
    },
    {
      "sport": "gymnastics",
      "url": "https://uclabruins.com/sports/womens-gymnastics/schedule/",
      "label": "Women's Gymnastics"
    }
  ],
  "stanford": [
    {
      "sport": "volleyball",
      "url": "https://gostanford.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    },
    {
      "sport": "rowing",
      "url": "https://gostanford.com/sports/mens-rowing/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://gostanford.com/sports/womens-basketball/schedule/",
      "label": "Women's Basketball"
    }
  ],
  "usc": [
    {
      "sport": "football",
      "url": "https://usctrojans.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://usctrojans.com/sports/womens-basketball/schedule/",
      "label": "Women's Basketball"
    },
    {
      "sport": "baseball",
      "url": "https://usctrojans.com/sports/baseball/schedule/"
    }
  ],
  "washington": [
    {
      "sport": "football",
      "url": "https://gohuskies.com/sports/football/schedule/"
    },
    {
      "sport": "rowing",
      "url": "https://gohuskies.com/sports/mens-rowing/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://gohuskies.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    }
  ],
  "ohio-state": [
    {
      "sport": "football",
      "url": "https://ohiostatebuckeyes.com/sports/football/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://ohiostatebuckeyes.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "hockey",
      "url": "https://ohiostatebuckeyes.com/sports/womens-ice-hockey/schedule/",
      "label": "Women's Ice Hockey"
    }
  ],
  "penn-state": [
    {
      "sport": "football",
      "url": "https://gopsusports.com/sports/football/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://gopsusports.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    },
    {
      "sport": "hockey",
      "url": "https://gopsusports.com/sports/mens-ice-hockey/schedule/"
    }
  ],
  "duke": [
    {
      "sport": "basketball",
      "url": "https://goduke.com/sports/mens-basketball/schedule/"
    },
    {
      "sport": "football",
      "url": "https://goduke.com/sports/football/schedule/"
    }
  ],
  "uconn": [
    {
      "sport": "basketball",
      "url": "https://uconnhuskies.com/sports/womens-basketball/schedule/",
      "label": "Women's Basketball"
    },
    {
      "sport": "hockey",
      "url": "https://uconnhuskies.com/sports/mens-ice-hockey/schedule/"
    }
  ],
  "wisconsin": [
    {
      "sport": "football",
      "url": "https://uwbadgers.com/sports/football/schedule/"
    },
    {
      "sport": "volleyball",
      "url": "https://uwbadgers.com/sports/womens-volleyball/schedule/",
      "label": "Women's Volleyball"
    },
    {
      "sport": "hockey",
      "url": "https://uwbadgers.com/sports/womens-ice-hockey/schedule/",
      "label": "Women's Ice Hockey"
    }
  ],
  "mines": [
    {
      "sport": "football",
      "url": "https://minesathletics.com/sports/football/schedule/"
    },
    {
      "sport": "track",
      "url": "https://minesathletics.com/sports/track-and-field/schedule/"
    }
  ],
  "williams": [
    {
      "sport": "rowing",
      "url": "https://ephsports.williams.edu/sports/mens-crew/schedule/"
    },
    {
      "sport": "basketball",
      "url": "https://ephsports.williams.edu/sports/mens-basketball/schedule/"
    }
  ]
} as const satisfies Record<UniversityId, readonly {sport: string; url: string; label?: string}[]>;
