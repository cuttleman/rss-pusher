import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  console.log("post actions trigger!");
  res.json({
    callback_type: "views.open",
    new_view: {
      view_id: "builder_test",
      header: {
        title: "This is a view title",
        subtitle: "Add a subtitle if needed",
        context_menu: [
          {
            label: "Menu item 1",
            action_id: "2fc5573a-c439-4131-9c82-6ed78c1f1758",
          },
          {
            label: "Menu item 2",
            action_id: "340d4ae1-0cb2-42c7-8880-4b5c2aed0f2d",
          },
          {
            label: "Menu item 3",
            action_id: "449fec68-ad54-4ee8-aa29-1c56957868c7",
          },
        ],
        buttons: [
          {
            type: "button",
            icon: {
              type: "image",
              image_url:
                "https://swit.io/assets/images/lib/emoji/apple-64/1f609.png",
              alt: "Header button icon",
            },
            static_action: {
              action_type: "open_link",
              link_url: "https://swit.io",
            },
          },
        ],
      },
      body: {
        elements: [
          {
            type: "list_item",
            action_id: "56203f1b-b910-4bcc-8378-c26985dbf4ac",
            title: "Swit",
            subtitle: "An incredibly powerful collaboration tool",
            snippet:
              "Swit provides seamless workflows coupling chat and tasks in one convenient place. A powerful alternative for a heavy collection of single-function tools, it supports all features that Slack and Trello (or Asana) have—faster, better, and safer.",
            icon: {
              type: "image",
              image_url: "https://files.swit.io/thumb_swit.png",
              shape: "circular",
            },
            image: {
              type: "image",
              image_url: "https://files.swit.io/thumb_swit.png",
            },
          },
          {
            type: "tabs",
            tabs: [
              {
                label: "Tab 1",
                action_id: "2de7af7c-43db-4b1f-9d8d-02636590371d",
              },
              {
                label: "Tab 2",
                action_id: "76e92c88-f729-4f7d-b5e0-dd497d8433f5",
              },
            ],
          },
        ],
      },
    },
  });
});

export default router;
