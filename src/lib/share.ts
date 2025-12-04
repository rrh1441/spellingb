// src/lib/share.ts
// Wordle-style sharing utilities

export interface ShareData {
  score: number;
  correctCount: number;
  totalWords: number;
  streak: number;
  difficulty: "easy" | "medium" | "hard";
  dayNumber: number;
  attempts: string[];
  correctWords: string[];
}

// Calculate game day number from reference date
export function getGameDayNumber(): number {
  const referenceDate = new Date("2023-01-01");
  const today = new Date();
  const diffTime = today.getTime() - referenceDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Generate emoji grid showing results
function generateEmojiGrid(attempts: string[], correctWords: string[]): string {
  return attempts
    .map((attempt, i) => {
      const correct = correctWords[i];
      if (!correct) return "⬜"; // No word for this slot

      const isCorrect = attempt.trim().toLowerCase() === correct.trim().toLowerCase();
      return isCorrect ? "✅" : "❌";
    })
    .join(" ");
}

// Get difficulty emoji
function getDifficultyEmoji(difficulty: "easy" | "medium" | "hard"): string {
  switch (difficulty) {
    case "easy":
      return "🟢";
    case "medium":
      return "🟡";
    case "hard":
      return "🔴";
    default:
      return "🟡";
  }
}

// Generate shareable text
export function generateShareText(data: ShareData): string {
  const { score, correctCount, totalWords, streak, difficulty, dayNumber, attempts, correctWords } = data;

  const emojiGrid = generateEmojiGrid(attempts, correctWords);
  const difficultyEmoji = getDifficultyEmoji(difficulty);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  let text = `Spelling B- #${dayNumber} ${difficultyEmoji}\n`;
  text += `${emojiGrid}\n`;
  text += `Score: ${score} | ${correctCount}/${totalWords}`;

  if (streak > 1) {
    text += ` | 🔥${streak}`;
  }

  text += `\n${difficultyLabel} Mode`;
  text += `\n\nspellingb.com`;

  return text;
}

// Share results using Web Share API or clipboard fallback
export async function shareResults(data: ShareData): Promise<{ success: boolean; method: "share" | "clipboard" | "failed" }> {
  const shareText = generateShareText(data);

  const shareData = {
    title: "Spelling B- Results",
    text: shareText,
  };

  // Try Web Share API first
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return { success: true, method: "share" };
    } catch (error) {
      // User cancelled or share failed
      if ((error as DOMException).name === "AbortError") {
        return { success: false, method: "failed" };
      }
    }
  }

  // Fallback to clipboard
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareText);
      return { success: true, method: "clipboard" };
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }

  return { success: false, method: "failed" };
}
