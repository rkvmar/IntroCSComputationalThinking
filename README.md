# Intro CS Computational Thinking Thingy

-# "Is this just a robot turtles clone"

## Install + Run

- Clone repo
- navigate to directory
- run `npm install`
- run `npm run dev`
- navigate to `localhost:5173`

## Level modification

- navigate to `./static/levels.json`
- levels are each a 2d array of numbers and objects

### EXAMPLE

```
{
  "title": "no way",
  "contents": [
    [0, 0, 0, 0, 0],
    [0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0]
  ],
 "allowedCommands": ["f"]
}
```

Grid size will be based on the size of the 2d array
WARNING: things may break if the size of the arrays in the main array are not the same
KEY:

```
0: Empty Space
1: Player Spawn
2: Goal
3: Wall
```

You can also choose what actions are allowed, current programmed actions are:

```
"f" - move forward
"l" - turn left
"r" - turn right
"loop" - make a loop
```

### EXAMPLE WITH COMPLEX OBJECTS

There are also more complex configurable objects that can be added

```
{
    "title": "Door™",
    "contents": [
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
      [
        3,
        3,
        {
          "type": "door",
          "id": "keyDoor",
          "defaultCode": {
            "condition": "has key",
            "ifCommands": ["open"],
            "elseCommands": ["close"]
          },
          "allowedConditions": ["has key", "never"],
          "allowedActions": ["open", "close"],
          "conditionsEditable": false,
          "actionsEditable": false,
          "isOpen": false
        },
        3,
        3
      ],
      [
        0,
        0,
        0,
        {
          "type": "key",
          "id": "key1",
          "collected": false
        },
        0
      ],
      [0, 0, 1, 0, 0]
    ],
    "allowedCommands": ["f", "r", "l", "loop"]
  }
```

OBJECTS:
Door and Key for conditionals practice

```
"type": "door" - makes a door
for door:
"defaultCode" - the pseudocode that the door is preprogrammed with
"allowedConditions" - the things you are allowed to use as conditions for the door
"allowedActions" - the things you can use as actions for the door (right now just open and close)
"conditionsEditable" - if you are allowed to edit the door condition
"actionsEditable" - if you are allowed to edit the door actions

"type": "key" - makes a key
there isnt much you need to configure for the keys
```

-# I sure hope this documentation is good enough
