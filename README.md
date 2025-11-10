# Persona Finder

**ユング心理学の4機能モデルをアーキテクチャ的に再構成した、認知機能診断アプリ。**  
本ツールは、理論を単に引用するのではなく、**心理学的モデルの形式的妥当性をコードで検証する試み**として設計されています。

---

## コンセプト

> 「理論を読むのではなく、動かす。」

Persona Finder は、Carl Gustav Jung の認知機能モデル（思考・感情・直観・感覚 × 内向／外向）を  
Web上で再現・可視化することで、人間の認知様式を**システムとして理解する**ことを目指しています。  

このプロジェクトは、心理学理論を「静的な分類」から「動作する構造モデル」へと変換し、  
**自己理解の過程をインタラクティブに観察する実験的プラットフォーム**として設計されています。  

---

## 特徴

- **透明性のある設計**：診断ロジック・重み付けをすべてオープンに公開  
- **理論検証ツールとしての構造性**：心理学的仮説を動作コードとして実験可能  
- **非決定論的アプローチ**：診断は“分類”ではなく、**認知構造の動的バランスを仮説的に提示**  
- **自己省察支援**：回答を通じて、自我と無意識（Shadow）の関係を再考する体験設計  
- **教育・研究利用を想定**：心理モデルの検証・授業実験・認知科学教育への応用を想定  

---

## 技術スタック

- HTML / CSS / Vanilla JavaScript
- モジュール分割構成：`data.js`・`core.js`・`app.js`
- Accessibility対応（WAI-ARIA・キーボードナビゲーション）
- スムースアニメーション・レスポンシブ設計
- Netlify, Vercel等の静的ホスティングに対応

---

## 理論背景

本ツールはユング心理学およびMBTI理論を参考にしていますが、
既存の性格診断サイトとは異なり、**理論の形式的構造をシステム的に再構築**しています。
そのため、診断結果は確定的な“タイプ”ではなく、**認知構造の仮説的表現**として提供されます。

背後にあるモデルは、Carl Jung の心理的タイプ論（1921）および Grant–Brownsword モデルに基づき、
**主機能・補助機能・第三機能・劣等機能**の階層構造を数学的に再現。
また、S.S. Stevens の心理物理学的法則に基づき、**確信度を非線形スコア（指数補正）**で表現しています。

---

## 設計思想

> 人間の認知は固定的な型ではなく、変動する構造体である。
> 理論とは、その構造を観察するための“計測装置”にすぎない。

Persona Finder は、  
「ペルソナ」や「タイプ」といったラベル化をのみ目的とせず、  
理論そのものを**動的に実行・観察する試験装置**として位置づけています。  

その意味で、コードは結論ではなく、**理論の仮説性を検証するための実験手段**です。
ユーザーが対話的に応答する過程そのものが、
“認知の変化を観察する心理的シミュレーション”となるよう設計されています。

---

## ライセンス

学術・教育目的での非営利利用を許諾（CC BY-NC-SA 4.0）。  
商用利用または再配布をご希望の方は、[こちらまでお問い合わせください](mailto:hkurokawadev@gmail.com)。

---

## 作者の意図

> これは、人間の認知様式をアーキテクチャ的に理解しようとした試みであり、
> コードは理論の試金石に過ぎません。
> 理論の限界を知り、それでも自分を見つめ直す道具として価値を感じるなら、使ってください。


# Persona Finder

> **A Cognitive Architecture built with Vanilla JavaScript —  
> where Jungian psychology meets formal system design.**

---

## Overview

**Persona Finder** is a psychological diagnosis tool that reconstructs  
Carl Gustav Jung’s *Cognitive Function Model* as a formal, interactive system.  

Rather than quoting theory, this project **implements and validates psychological structure through code**,  
transforming Jung’s framework into a living, testable model.

---

## Core Concept

> *Don’t just read theory. Execute it.*

The project treats cognition as an **architectural system**, not a personality label.  
Each response dynamically alters the cognitive balance (Dominant–Inferior functions),  
allowing users to visualize how perception and judgment shift in real time.

---

## Tech Stack

- **Vanilla JavaScript** (no frameworks)  
- **Modular architecture**: `data.js`, `core.js`, `app.js`  
- **Accessible UI**: WAI-ARIA compliant, keyboard-navigable  
- **Responsive design** with smooth transitions  
- **Deploy-ready** for static environments (Netlify, GitHub Pages)  

---

## Theoretical Model

Based on:  
- Carl G. Jung — *Psychological Types* (1921)  
- Grant-Brownsword Cognitive Function Hierarchy  
- S.S. Stevens — *Psychophysical Scaling Law* (1957)

> Instead of deterministic typing, Persona Finder outputs a  
> **hypothetical representation of cognitive structure** —  
> visualizing function balance and intensity as dynamic variables.

---

## Design Philosophy

> “Human cognition is not a fixed type, but a shifting structure.  
>  Theory is merely the instrument for observing it.”

- **Transparent algorithms** — all logic and weighting are open-source  
- **Non-deterministic results** — emphasizes patterns, not categories  
- **Interactive reflection** — user feedback loop as self-observation  
- **Formal verification mindset** — code as an empirical test of theory  

This project treats *psychology as executable architecture*:  
an experiment in whether theoretical constructs can sustain computational form.  

---

## What It Demonstrates

Systems thinking applied to human cognition  
Model-driven architecture in pure JavaScript  
Research-grade documentation and accessibility compliance  
Theory-driven engineering — where code equals hypothesis  

---

## License

CC BY-NC-SA 4.0 — free for academic and non-commercial use.  
For commercial licensing or collaboration, please contact  
📩 **hkurokawadev@gmail.com**

---

## Author’s Note

> This project is not about simulating the human mind.  
> It’s about understanding theory through implementation.  
> If you find value in seeing the limits of models — use it.

---

