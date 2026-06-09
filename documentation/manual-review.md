# Manual human review

file: src/routes/auctions.$auctionId.tsx

i do not like that there is multiple useEffects. useEffects should be avoid.

one of the useEffects is 60 lines long. That is a code smell.

i dont like that the file is 287 lines long.

Is it possible to split the file into more of a logic(controls) and view parts?

I dont see that we use any hooks. Can we extract logic to hooks?
for example, placeBidHook.

in file based routing, is there a way to add folders to the routes folder? i find it hard to distingvise between an api and a page.
