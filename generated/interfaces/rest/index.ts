// Auto-generated entrypoint for kit "conduit", target "rest"
import { Router } from 'express';
import { ArticleRouter } from './Article/Article.routes';
import { CommentRouter } from './Comment/Comment.routes';
import { EchoRouter } from './Echo/Echo.routes';
import { FavoriteRouter } from './Favorite/Favorite.routes';
import { FollowRouter } from './Follow/Follow.routes';
import { JWTRouter } from './JWT/JWT.routes';
import { PasswordRouter } from './Password/Password.routes';
import { ProfileRouter } from './Profile/Profile.routes';
import { TagRouter } from './Tag/Tag.routes';
import { UserRouter } from './User/User.routes';

const router = Router();

  router.use('/Article', ArticleRouter);
  router.use('/Comment', CommentRouter);
  router.use('/Echo', EchoRouter);
  router.use('/Favorite', FavoriteRouter);
  router.use('/Follow', FollowRouter);
  router.use('/JWT', JWTRouter);
  router.use('/Password', PasswordRouter);
  router.use('/Profile', ProfileRouter);
  router.use('/Tag', TagRouter);
  router.use('/User', UserRouter);

export default router;
