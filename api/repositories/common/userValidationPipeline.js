const userValidationPipeline = (options = {}) => {
  const { allowPrivate = false } = options

  const privacyFilter = allowPrivate
    ? []
    : [
        {
          $or: [
            { private: false },
            {
              $and: [
                { private: true },
                { $or: [{ isFollowing: true }, { _sameUser: true }] },
              ],
            },
          ],
        },
      ]

  return [
    {
      $match: {
        $and: [
          { banned: { $ne: true } },
          { status: "public" },
          { verified_email: true },
          ...privacyFilter,
        ],
      },
    },
  ]
}

module.exports = userValidationPipeline
