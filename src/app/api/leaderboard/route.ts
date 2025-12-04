// src/app/api/leaderboard/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// GET /api/leaderboard - Fetch today's leaderboard
export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const searchParams = request.nextUrl.searchParams;
  const difficulty = searchParams.get("difficulty") || "easy";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("username, score, correct_count, created_at")
      .eq("game_date", today)
      .eq("difficulty", difficulty)
      .order("score", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Leaderboard fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }

    return NextResponse.json({
      date: today,
      difficulty,
      entries: data || [],
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/leaderboard - Submit a score
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { user_id, username, score, correct_count, difficulty } = body;

    // Validate required fields
    if (!user_id || score === undefined || correct_count === undefined || !difficulty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate difficulty
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    // Validate score (basic anti-cheat)
    const maxPossibleScore = 150 + 60; // 3 words * 50 + 60 seconds
    if (score < 0 || score > maxPossibleScore) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if user already submitted today for this difficulty
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("id")
      .eq("user_id", user_id)
      .eq("game_date", today)
      .eq("difficulty", difficulty)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already submitted today" }, { status: 409 });
    }

    // Insert new score
    const { data, error } = await supabase
      .from("leaderboard")
      .insert({
        user_id,
        username: username || "Anonymous",
        score,
        correct_count,
        difficulty,
        game_date: today,
      })
      .select()
      .single();

    if (error) {
      console.error("Leaderboard insert error:", error);
      return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
    }

    return NextResponse.json({ success: true, entry: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
