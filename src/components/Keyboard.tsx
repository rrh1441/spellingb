// src/components/Keyboard.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  isIpad: boolean;
  showIpadKeyboard: boolean;
  setShowIpadKeyboard: (show: boolean) => void;
}

const keyboardRows = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", "del"]
];

export const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress,
  isIpad,
  showIpadKeyboard,
  setShowIpadKeyboard,
}) => {
  if (isIpad && !showIpadKeyboard) {
    return (
      <div className="flex justify-center mt-4">
        <Button
          onClick={() => setShowIpadKeyboard(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
        >
          Get Keyboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {keyboardRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center space-x-1">
          {row.map((key) => {
            if (key === "del") {
              return (
                <Button
                  key={key}
                  onClick={() => onKeyPress("backspace")}
                  className="w-12 h-11 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md flex items-center justify-center"
                  aria-label="Delete"
                >
                  DEL
                </Button>
              );
            }
            return (
              <Button
                key={key}
                onClick={() => onKeyPress(isIpad ? key.toLowerCase() : key)}
                className="w-8 h-11 text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
                aria-label={key.toUpperCase()}
              >
                {key.toUpperCase()}
              </Button>
            );
          })}
        </div>
      ))}
      <div className="flex justify-center space-x-1">
        <Button
          onClick={() => onKeyPress("submit")}
          className="w-24 h-11 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center justify-center text-xl font-semibold"
          aria-label="Enter"
        >
          Enter
        </Button>
      </div>
    </div>
  );
};