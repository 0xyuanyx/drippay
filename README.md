# ERC-20 SubStream

ERC-20 SubStream is a prototype settlement protocol for small recurring
subscription payments. Instead of transferring prepaid funds as one lump sum,
the payer deposits ERC-20 tokens into a contract and the payee earns them
continuously over time.

## Problem

Shared subscription groups create three recurring risks:

- the group owner can take prepaid funds and stop providing access
- a member can keep using the account without paying on time
- empty seats can leave the owner paying for unused capacity

The common issue is that payment moves in large chunks, so one side must trust
the other before receiving the matching service or money.

## Approach

SubStream treats payment as a time-based flow:

- a member deposits ERC-20 tokens for a fixed duration
- the contract calculates the earned amount from elapsed time
- the owner can withdraw only the amount already earned
- the member can cancel and recover the unearned balance

This does not prove off-chain service delivery. It only automates settlement
rules and limits the size of prepaid loss.

## Core Contract Ideas

- ERC-20 `approve` and `transferFrom` for deposits
- time-based settlement instead of per-second transactions
- `withdraw` for earned funds
- `cancel` for final settlement and refund
- waitlist and cancellation penalty logic for empty-seat risk

## Demo Scenario

1. A member deposits 10,000 tokens for a 30-day stream.
2. The test chain advances by 15 days.
3. The contract reports 5,000 tokens earned and 5,000 refundable.
4. The owner withdraws the earned tokens.
5. A waitlisted member replaces the canceling member without a penalty.

## Scope

This project focuses on ERC-20 based settlement logic. It does not solve account
access verification, password sharing enforcement, or platform policy issues.
