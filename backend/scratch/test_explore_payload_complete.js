require("dotenv").config();
const { createPool } = require("../config/db");
const { getExploreFeed } = require("../controllers/exploreController");
const pool = createPool();

const req = { user: { id: 155, type: 'member' }, app: { locals: { pool } } };
const res = {
  json: (data) => {
    console.log("=== EXPLORE PAYLOAD VERIFICATION ===");
    console.log("Hero:", {
      title: data.hero.title,
      isInterested: data.hero.isInterested,
      spotsLeft: data.hero.spotsLeft,
      isLiveNow: data.hero.isLiveNow,
      isFree: data.hero.isFree
    });
    console.log("Weekend [0]:", {
      title: data.weekend[0].title,
      attendeeCount: data.weekend[0].attendeeCount,
      isInterested: data.weekend[0].isInterested,
      spotsLeft: data.weekend[0].spotsLeft,
      isLiveNow: data.weekend[0].isLiveNow,
      isFree: data.weekend[0].isFree
    });
    console.log("CategoryRail [0] Event [0]:", {
      title: data.categoryRails[0].events[0].title,
      isInterested: data.categoryRails[0].events[0].isInterested,
      spotsLeft: data.categoryRails[0].events[0].spotsLeft,
      isLiveNow: data.categoryRails[0].events[0].isLiveNow,
      isFree: data.categoryRails[0].events[0].isFree
    });
    console.log("SomethingDifferent [0]:", {
      title: data.somethingDifferent[0].title,
      categoryName: data.somethingDifferent[0].categoryName,
      categorySlug: data.somethingDifferent[0].categorySlug,
      isInterested: data.somethingDifferent[0].isInterested,
      spotsLeft: data.somethingDifferent[0].spotsLeft,
      isLiveNow: data.somethingDifferent[0].isLiveNow,
      isFree: data.somethingDifferent[0].isFree
    });
    console.log("CuratedLists count:", data.curatedLists?.length);
    if (data.curatedLists?.length > 0) {
      console.log("CuratedList [0]:", {
        id: data.curatedLists[0].id,
        title: data.curatedLists[0].title,
        subtitle: data.curatedLists[0].subtitle,
        eventsCount: data.curatedLists[0].events?.length
      });
    }
    process.exit(0);
  },
  status: (code) => ({
    json: (err) => {
      console.error("Status", code, err);
      process.exit(1);
    }
  })
};

getExploreFeed(req, res);
