# 🎯 UPSC AWFG 3-Month Intensive Prep Engine & Microthemes Tracker

> Built with 20+ years of senior full-stack web engineering craft: zero external dependencies, ultra-fast vanilla reactive architecture, local-storage state persistence, dynamic schedule recalculation, and deep microtheme synergy mapping.

---

## 🚀 How to Run the Website

### Option 1: Double-Click (Zero Setup Required)
Open `index.html` directly in any modern browser (Google Chrome, Safari, Microsoft Edge, Brave, Mozilla Firefox):
```bash
open "/Users/ramansingh/Documents/awfg website/index.html"
```
*(All data, styles, and logic run 100% offline and store your progress in your browser's persistent storage.)*

### Option 2: Run a Local Dev Server (Optional)
If you prefer running via HTTP:
```bash
cd "/Users/ramansingh/Documents/awfg website"
python3 -m http.server 8080
```
Then navigate to: `http://localhost:8080`

---

## 🌟 Key Features & Implementation Highlights

### 1. User-Defined Target Duration & Dynamic Date Engine (No Hardcoded 90 Days)
- **User-Defined Target Days**: Enter **any custom duration** in the top header (`🎯 Target Duration: [ 90 ] Days`). Whether you want to complete all 33 tests in **45 days**, **60 days**, **75 days**, **90 days**, or **120 days**, the system dynamically recalculates and scales the target dates for all 33 tests on the fly!
- **Dynamic Cadence Spacing**:
  - **Auto Distribute across Target Days** *(Proportionally spaces all 33 tests and reserves a ~12% buffer for final revisions)*
  - **Mon-Wed-Fri Pattern**
  - **Tue-Thu-Sat Pattern**
  - **Every 2 Days (Fixed 66d)**
  - **Every 3 Days (Fixed 99d)**
- **Floating Back-to-Top Button**: A smooth upward arrow button (`▲`) appears automatically at the bottom-right as you scroll down; click it anytime to smoothly glide back to the top!

### 2. Actual Completion Date & Real-Time Delay Tracking
- Each test card has an **Actual Date** input field.
- If you fall behind or complete early, the system detects delays automatically:
  - `🟢 Completed (On Schedule)`: Finished on or before target date
  - `🟡 Delayed (+X days actual)`: Finished X days after target date
  - `🔴 Overdue (+X days)`: Incomplete and past the scheduled target date
  - `🔵 On Track`: Scheduled in the future

### 3. Deep Prelims & Mains Microthemes Synergy Mapping & Interactive PYQ Explorer
- **Interactive Question Access**: Click on **ANY microtheme** (or its `❓ View Questions` pill) across any of the 33 test cards or the Synergy Matrix to immediately open the **Microtheme PYQ Explorer Modal**:
  - **📝 Mains PYQs (2013–2026)**: Complete historical Mains questions tagged by Year (e.g. `UPSC 2026`), Marks (`10M` / `15M`), Subject, full question text, and a 1-click `📋 Copy` button for drafting answers.
  - **🎯 Prelims PYQs (2008–2026)**: Complete historical Prelims objective questions tagged by Year, full stem, options `(a), (b), (c), (d)`, and an interactive `[👁️ Reveal Official Answer]` self-testing toggle (`Ans: (C)`).
  - **Real-Time In-Modal Search**: Instantly filter questions by year, keywords, or legal provisions.
- **Coinciding Prelims Topics (`🔗 Prelims + Mains Overlap`)**: Placed **directly below** the corresponding Mains syllabus topic within each test card, with notes on how to integrate Prelims facts into Mains analytical answers.
- **Prelims-Exclusive Topics (`⚡ Prelims-Exclusive Focus Topics`)**: Grouped into a separate dedicated section within each test card, spotlighting high-frequency factual recall, lists, constitutional articles, and PYQs (2008–2026).
- **Master Synergy Matrix View**: A full tabular cross-reference of all 209 Prelims microthemes categorized across 12 subjects, each with a direct `👁️ View PYQs` button.

### 4. Interactive Granular Tick-Marks (Multi-Level Progress Tracking)
- Tick checkboxes at 4 distinct levels:
  1. **Full Test Level**: Mark an entire test completed.
  2. **Mains Microthemes**: Check off individual microthemes as you study them.
  3. **Prelims Overlap & Exclusive Topics**: Check off Prelims factual microthemes.
  4. **WYSK Practice Questions**: Mark individual answer-writing questions as answered.
- Progress bars and KPI counters update dynamically as you tick off items.

### 5. Multi-User Aspirant Authentication & JSON Backup
- **ID & Password Sign In**: Create distinct study profiles (e.g., `Aspirant_2027`).
- **1-Click Guest Access**: Instant demo profile without password.
- **Export & Import Backup**: Click `⬇ Export` to download your entire checklist as a JSON backup file, and `⬆ Restore` to load it on any computer or browser.

### 6. Four Comprehensive Dedicated Views
1. **📋 Test Schedule**: Expandable cards for all 33 tests with full syllabus, microthemes, target dates, and actual dates.
2. **🗺️ 13-Week Roadmap**: Week-by-week timeline showing the exact cadence, buffer weeks, and paper transitions.
3. **⚡ Prelims vs Mains Synergy Matrix**: Exhaustive catalog of all 209 Prelims microthemes with PYQ counts and synergy classification.
4. **✍️ WYSK Question Bank**: Searchable repository of 264 high-yield "What You Should Know" questions.

---

## 📁 Project Structure

```
awfg website/
├── index.html            # Semantic, accessible HTML5 layout
├── style.css             # Modern responsive CSS (Dark/Light themes, badges, KPI cards)
├── data.js               # Full 33 tests, 358 Mains MTs, 209 Prelims MTs, 264 WYSK questions
├── app.js                # State management, date calculations, auth, and UI reactivity
├── build_full_data.py    # Python data extraction and normalization engine
└── extracted_raw.json    # Structured JSON parsed from Google Sheet tabs
```
