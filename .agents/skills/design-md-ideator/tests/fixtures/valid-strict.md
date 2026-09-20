---
version: alpha
name: Test System
description: A validator fixture.
colors:
  primary: "#1A1C1E"
  primary-hover: "#303337"
  on-primary: "#FFFFFF"
  surface: "#F7F5F2"
  on-surface: "#1A1C1E"
typography:
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.01em
rounded:
  md: 8px
spacing:
  sm: 8px
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Test System

## Overview

A professional, readable interface for testing.

## Colors

Primary drives emphasis; surface and on-surface define readable content.

## Typography

Public Sans provides a compact hierarchy.

## Layout

An 8px rhythm governs spacing and containment.

## Elevation & Depth

Tonal contrast and borders create depth.

## Shapes

Medium radii soften interactive controls.

## Components

Buttons use semantic tokens and explicit hover variants.

## Do's and Don'ts

- Do preserve readable contrast.
- Don't create duplicate emphasis.
